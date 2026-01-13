import init, { compile_typst, init_fonts } from "./pkg/typst_ppt_engine.js";

// --- UTILITIES ---
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const encodeSource = str => btoa(String.fromCharCode(...textEncoder.encode(str)));
const decodeSource = base => textDecoder.decode(Uint8Array.from(atob(base), c => c.charCodeAt(0)));
const debug = (...args) => console.log("[TypstAddin]", ...args);
const setStatus = (msg, isError = false) => {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("error", !!isError);
};
const computeSizeFromSvg = (svg, scale = 1.0, fallbackWidth = 300) => {
  const match = /viewBox\s*=\s*["']\s*([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s*["']/i.exec(svg);
  if (match) {
    const [, , , vbW, vbH] = match.map(Number);
    if (vbW > 0 && vbH > 0) {
      return { width: vbW * scale, height: vbH * scale };
    }
  }
  return { width: fallbackWidth, height: fallbackWidth * 0.6 };
};
const applyHeightToSvg = (svg, targetHeight) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const el = doc.documentElement;
    const viewBoxAttr = el.getAttribute("viewBox");
    if (!viewBoxAttr) {
      return { svg, size: computeSizeFromSvg(svg) };
    }
    const parts = viewBoxAttr.trim().split(/\s+/).map(Number);
    if (parts.length !== 4 || parts[2] <= 0 || parts[3] <= 0) {
      return { svg, size: computeSizeFromSvg(svg) };
    }
    const aspect = parts[2] / parts[3];
    // If no target height specified, use the natural size from viewBox
    const h = targetHeight || parts[3];
    const w = h * aspect;
    el.setAttribute("height", `${h}`);
    el.setAttribute("width", `${w}`);
    const serialized = new XMLSerializer().serializeToString(el);
    return { svg: serialized, size: { width: w, height: h } };
  } catch (e) {
    debug("applyHeightToSvg failed", e);
    return { svg, size: computeSizeFromSvg(svg) };
  }
};

let isWasmReady = false;
let lastTypstSelection = null; // { slideId, shapeId, left, top, width, height }
let compilerConfig = { compilerUrl: null, compilerAuth: null };

async function loadCompilerConfig() {
  try {
    const res = await fetch("./config.json", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      compilerConfig = {
        compilerUrl: json.compilerUrl || window.TYPST_COMPILER_URL || null,
        compilerAuth: json.compilerAuth || window.TYPST_COMPILER_AUTH || null,
      };
    } else {
      compilerConfig = {
        compilerUrl: window.TYPST_COMPILER_URL || null,
        compilerAuth: window.TYPST_COMPILER_AUTH || null,
      };
    }
  } catch {
    compilerConfig = {
      compilerUrl: window.TYPST_COMPILER_URL || null,
      compilerAuth: window.TYPST_COMPILER_AUTH || null,
    };
  }
  if (compilerConfig.compilerUrl) {
    debug("Remote compiler configured", compilerConfig.compilerUrl);
    document.getElementById("insertBtn").innerText = "Insert / Update";
    document.getElementById("insertBtn").disabled = false;
    setStatus("Remote compiler ready");
  }

  // Load persisted font size
  const savedSize = localStorage.getItem("typstFontSize");
  if (savedSize) {
    document.getElementById("fontSize").value = savedSize;
  }
}

// --- INITIALIZATION ---
Office.onReady(async (info) => {
  if (info.host === Office.HostType.PowerPoint) {
    await loadCompilerConfig();
    await setupWasm();

    // Listen for when the user clicks a different shape
    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      onSelectionChange,
    );

    // Perform initial check in case user selected a shape before opening the pane
    onSelectionChange();
  }
});

async function setupWasm() {
  try {
    await init();
    const fontRes = await fetch("./assets/math-font.ttf");
    const fontBuffer = await fontRes.arrayBuffer();
    init_fonts(new Uint8Array(fontBuffer));

    isWasmReady = true;
    // If no remote compiler is present, WASM readiness enables the button
    if (!compilerConfig.compilerUrl) {
      document.getElementById("insertBtn").innerText = "Insert / Update";
      document.getElementById("insertBtn").disabled = false;
      setStatus("WASM ready");
    } else {
      debug("WASM initialized (backup to remote compiler)");
    }
    debug("WASM initialized");
    updatePreview();
  } catch (err) {
    console.error("WASM Load Error:", err);
    if (!compilerConfig.compilerUrl) {
      setStatus("Failed to load WASM. See console for details.", true);
    } else {
      setStatus("Using remote compiler (WASM load failed).");
      document.getElementById("insertBtn").disabled = false;
    }
  }
}

async function compileRemote(source) {
  if (!compilerConfig.compilerUrl) return null;
  setStatus("Compiling via remote service...");
  debug("Remote compile request to", compilerConfig.compilerUrl);
  try {
    const headers = { "Content-Type": "application/json" };
    if (compilerConfig.compilerAuth) {
      headers["Authorization"] = `Bearer ${compilerConfig.compilerAuth}`;
    }
    const res = await fetch(compilerConfig.compilerUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ source, format: "svg" }),
    });
    if (!res.ok) {
      debug("Remote compile HTTP error", res.status, res.statusText);
      throw new Error(`Remote compile failed (${res.status})`);
    }
    const data = await res.json();
    if (data.error) {
      debug("Remote compile returned error", data.error);
      throw new Error(data.error);
    }
    if (!data.svg) {
      debug("Remote compile missing svg field", data);
      throw new Error("Remote compile did not return SVG");
    }
    debug("Remote compile success; svg length", data.svg.length);
    return data.svg;
  } catch (err) {
    console.error("Remote compile error:", err);
    setStatus(`Remote compile failed: ${err.message}`, true);
    return `Error: ${err.message}`;
  }
}

// --- CORE LOGIC: INSERT OR REPLACE ---
async function handleAction() {
  const rawCode = document.getElementById("typstInput").value;
  const fontSize = document.getElementById("fontSize").value || 20;

  // Persist font size
  localStorage.setItem("typstFontSize", fontSize);

  // Prepend font size setting to code
  const fullCode = `#set text(size: ${fontSize}pt)\n${rawCode}`;

  debug("Handle action start");
  let svgOutput;
  if (compilerConfig.compilerUrl) {
    svgOutput = await compileRemote(fullCode);
  } else {
    if (!isWasmReady) {
      setStatus("WASM not ready; cannot compile.", true);
      return;
    }
    try {
      svgOutput = compile_typst(fullCode);
    } catch (err) {
      console.error("Compile Error:", err);
      setStatus("Typst compile failed. See console for details.", true);
      return;
    }
  }

  if (typeof svgOutput !== "string" || svgOutput.startsWith("Error:")) {
    setStatus(svgOutput || "Typst compile failed.", true);
    return;
  }

  // IMPORTANT: We now store ONLY the user's code in the payload.
  // The font size is stored separately in the shape's tags.
  const payload = `TYPST:${encodeSource(rawCode)}`;

  try {
    await PowerPoint.run(async (context) => {
      const selection = context.presentation.getSelectedShapes();
      const selectedSlides = context.presentation.getSelectedSlides();
      const allSlides = context.presentation.slides;
      selection.load("items");
      selectedSlides.load("items");
      allSlides.load("items");
      await context.sync();

      // Load props on selected shapes
      if (selection.items.length > 0) {
        selection.items.forEach(s => s.load(["id", "altTextDescription", "left", "top", "width", "height"]));
        await context.sync();
      }

      const count = selection.items.length;
      debug("Selected shapes:", count);

      let targetLeft = null;
      let targetTop = null;
      let targetHeight = null;
      let replacing = false;

      // Try current selection first
      let typstShape = selection.items.find(
        s => s.altTextDescription && s.altTextDescription.startsWith("TYPST:"),
      );

      // If nothing is selected (because taskpane grabbed focus), fall back to last remembered Typst selection
      if (!typstShape && lastTypstSelection) {
        try {
          const slide = allSlides.items.find(sl => sl.id === lastTypstSelection.slideId) || allSlides.items[0];
          if (slide) {
            slide.shapes.load("items");
            await context.sync();
            if (slide.shapes.items.length > 0) {
              slide.shapes.items.forEach(s => s.load(["id", "altTextDescription", "left", "top", "width", "height"]));
              await context.sync();
              typstShape = slide.shapes.items.find(s => s.id === lastTypstSelection.shapeId);
            }
          }
        } catch (e) {
          debug("Fallback to last selection failed:", e);
        }
      }

      if (typstShape) {
        targetLeft = typstShape.left;
        targetTop = typstShape.top;
        targetHeight = typstShape.height;
        typstShape.delete();
        replacing = true;
        await context.sync();
      }

      // Choose target slide: selected slide or first slide
      const targetSlide = selectedSlides.items[0] || allSlides.items[0];
      if (!targetSlide) {
        setStatus("No slide available to insert SVG.", true);
        return;
      }
      targetSlide.load(["id", "shapes/items/id"]);
      await context.sync();
      const targetSlideId = targetSlide.id;
      const existingIds = new Set(targetSlide.shapes.items.map(s => s.id));
      debug("Target slide chosen for insertion", targetSlideId);

      // Pre-size the SVG to minimize flicker on insert
      // NOTE: We pass null as targetHeight to applyHeightToSvg because we want the
      // SVG's natural size (computed from the font size) to dictate the shape size.
      // If we enforced targetHeight = typstShape.height, increasing font size wouldn't grow the shape visually.
      const sized = applyHeightToSvg(svgOutput, null);
      const svgToInsert = sized.svg;
      const fallbackSize = sized.size;

      // Insert via setSelectedDataAsync; after insertion, tag the shape
      Office.context.document.setSelectedDataAsync(
        svgToInsert,
        { coercionType: Office.CoercionType.XmlSvg },
        async (res) => {
          if (res.status !== Office.AsyncResultStatus.Succeeded) {
            console.error("Insert failed:", res.error);
            setStatus("Failed to insert SVG into the slide.", true);
            return;
          }

          await PowerPoint.run(async (ctx2) => {
            let shapeToTag = null;
            try {
              const slide = ctx2.presentation.slides.getItem(targetSlideId);
              slide.shapes.load("items/id");
              await ctx2.sync();
              const newShapes = slide.shapes.items.filter(s => !existingIds.has(s.id));
              if (newShapes.length > 0) {
                shapeToTag = newShapes[newShapes.length - 1];
              } else if (slide.shapes.items.length > 0) {
                shapeToTag = slide.shapes.items[slide.shapes.items.length - 1];
              }
            } catch (e) {
              debug("Shape diff fallback failed:", e);
            }

            if (!shapeToTag) {
              const postShapes = ctx2.presentation.getSelectedShapes();
              postShapes.load("items");
              await ctx2.sync();
              if (postShapes.items.length > 0) {
                shapeToTag = postShapes.items[postShapes.items.length - 1];
              }
            }

            if (!shapeToTag) {
              console.warn("No shape found after insertion; cannot tag Typst payload.");
              setStatus("Inserted SVG but could not tag it (no selection).", true);
              return;
            }

            shapeToTag.altTextDescription = payload;
            shapeToTag.name = "Typst Equation";
            // Persist the font size as a tag for robust round-tripping
            shapeToTag.tags.add("TypstFontSize", fontSize.toString());

            // Use the natural size of the generated SVG to respect the Font Size setting.
            // We ignore the previous shape's height (targetHeight) so that changing
            // settings like Font Size actually resizes the shape on the slide.
            const h = fallbackSize.height;
            const w = fallbackSize.width;

            if (h > 0 && w > 0) {
              shapeToTag.height = h;
              shapeToTag.width = w;
            }
            // Note: If SVG size parsing fails, we let PowerPoint use default sizing

            if (targetLeft !== null && targetTop !== null) {
              shapeToTag.left = targetLeft;
              shapeToTag.top = targetTop;
            }
            await ctx2.sync();
            debug("Inserted/updated shape tagged", { replacing, targetLeft, targetTop, size: fallbackSize, shapeId: shapeToTag.id, targetHeight });
            setStatus(replacing ? "Updated Typst SVG." : "Inserted Typst SVG.");
          });
        },
      );
    });
  } catch (err) {
    console.error("PowerPoint context error:", err);
    setStatus("PowerPoint API error. See console.", true);
  }
}

// --- ROUND-TRIP: DETECT SELECTION ---
async function onSelectionChange() {
  await PowerPoint.run(async (context) => {
    const shapes = context.presentation.getSelectedShapes();
    shapes.load("items");
    const slides = context.presentation.getSelectedSlides();
    slides.load("items/id");
    await context.sync();
    if (shapes.items.length > 0) {
      shapes.items.forEach(s => s.load(["id", "altTextDescription", "left", "top", "width", "height", "tags"]));
      await context.sync();
    }
    const count = shapes.items.length;
    debug("Selection changed, count:", count);

    const btn = document.getElementById("insertBtn");
    let isTypstShape = false;

    if (count >= 1) {
      const match = shapes.items.find(s => s.altTextDescription && s.altTextDescription.startsWith("TYPST:"));
      if (match && match.altTextDescription) {
        isTypstShape = true;
        const rawBase64 = match.altTextDescription.split("TYPST:")[1];
        try {
          let decoded = decodeSource(rawBase64);

          // 1. Try to read from Tags (New standard)
          let foundSize = null;
          try {
            // Accessing tag value requires loading and syncing
            const tag = match.tags.getItemOrNullObject("TypstFontSize");
            tag.load("value");
            await context.sync();

            if (!tag.isNullObject) {
              foundSize = tag.value;
            }
          } catch (e) {
            debug("Error reading tags", e);
          }

          // Always set the font size in UI - use found size or default to 20
          document.getElementById("fontSize").value = foundSize || "20";

          document.getElementById("typstInput").value = decoded;
          debug("Loaded Typst payload from selection");
          const slideId = slides.items.length > 0 ? slides.items[0].id : null;
          lastTypstSelection = {
            slideId,
            shapeId: match.id,
            left: match.left,
            top: match.top,
            width: match.width,
            height: match.height,
          };
          // Trigger preview update immediately
          updatePreview();
        } catch (err) {
          console.error("Decode error:", err);
          setStatus("Failed to decode Typst payload from selection.", true);
        }
      } else {
        debug("No TYPST payload on selection");
      }
    }

    if (!isTypstShape) {
      lastTypstSelection = null;
    }

    if (btn) {
      btn.innerText = isTypstShape ? "Update" : "Insert";
    }
  });
}

document.getElementById("insertBtn").onclick = handleAction;

document.getElementById("typstInput").addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    handleAction();
  }
});

let debounceTimer;
const fIn = document.getElementById("typstInput");
if (fIn) {
  fIn.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updatePreview();
    }, 300);
  });
}

const sIn = document.getElementById("fontSize");
if (sIn) {
  sIn.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updatePreview();
    }, 300);
  });
}

async function updatePreview() {
  const rawCode = document.getElementById("typstInput").value.trim();
  const fontSize = document.getElementById("fontSize").value || 20;
  const previewEl = document.getElementById("previewContent");

  if (!rawCode) {
    previewEl.innerHTML = "";
    return;
  }

  const fullCode = `#set text(size: ${fontSize}pt)\n${rawCode}`;

  // Don't show status for preview unless it's an error
  let svgOutput;

  // Prefer WASM for preview simply for speed, even if remote is configured?
  // Actually, if remote is configured, we might not have WASM loaded cleanly or at all.
  // But the setupWasm() is still called. If user has a remote compiler, maybe they need it for packages.
  // Let's stick to the config: if remote is set, use it.

  try {
    if (compilerConfig.compilerUrl) {
      // For preview, silence the status updates to avoid flicker
      // We'll reimplement a mini-compile without side effects on the status bar
      // Or just use the existing one but handle the status differently.
      // For now, let's just attempt a compile.

      // NOTE: compileRemote updates status. That might be annoying.
      // Let's rely on WASM if available for preview because it's instant?
      // No, consistency is better.
      svgOutput = await compileRemote(fullCode);
    } else {
      if (isWasmReady) {
        svgOutput = compile_typst(fullCode);
      }
    }
  } catch {
    // ignore preview errors or show small red text
  }

  if (svgOutput && !svgOutput.startsWith("Error:")) {
    previewEl.innerHTML = svgOutput;
    // Fix width/height for display if needed?
    // SVG usually scales to container width 100%
    const svgElement = previewEl.querySelector("svg");
    if (svgElement) {
      svgElement.style.width = "100%";
      svgElement.style.height = "auto";
      svgElement.style.maxHeight = "150px";
    }
  } else if (svgOutput && svgOutput.startsWith("Error:")) {
    previewEl.innerText = svgOutput;
    previewEl.style.color = "red";
  }
}
