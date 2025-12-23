import init, { compile_typst, init_fonts } from './pkg/typst_ppt_engine.js';

// --- UTILITIES ---
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const encodeSource = (str) => btoa(String.fromCharCode(...textEncoder.encode(str)));
const decodeSource = (base) => textDecoder.decode(Uint8Array.from(atob(base), (c) => c.charCodeAt(0)));
const debug = (...args) => console.log("[TypstAddin]", ...args);
const setStatus = (msg, isError = false) => {
    const el = document.getElementById('status');
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

let isWasmReady = false;

// --- INITIALIZATION ---
Office.onReady(async (info) => {
    if (info.host === Office.HostType.PowerPoint) {
        await setupWasm();
        
        // Listen for when the user clicks a different shape
        Office.context.document.addHandlerAsync(
            Office.EventType.DocumentSelectionChanged, 
            onSelectionChange
        );
    }
});

async function setupWasm() {
    try {
        await init();
        const fontRes = await fetch('./assets/math-font.ttf');
        const fontBuffer = await fontRes.arrayBuffer();
        init_fonts(new Uint8Array(fontBuffer));
        
        isWasmReady = true;
        document.getElementById('insertBtn').innerText = "Insert / Update";
        document.getElementById('insertBtn').disabled = false;
        setStatus("WASM ready");
        debug("WASM initialized");
    } catch (err) {
        console.error("WASM Load Error:", err);
        setStatus("Failed to load WASM. See console for details.", true);
    }
}

// --- CORE LOGIC: INSERT OR REPLACE ---
async function handleAction() {
    if (!isWasmReady) return;
    const code = document.getElementById('typstInput').value;
    debug("Handle action start");
    let svgOutput;
    try {
        svgOutput = compile_typst(code);
    } catch (err) {
        console.error("Compile Error:", err);
        setStatus("Typst compile failed. See console for details.", true);
        return;
    }

    if (typeof svgOutput !== "string" || svgOutput.startsWith("Error:")) {
        setStatus(svgOutput || "Typst compile failed.", true);
        return;
    }

    const payload = `TYPST:${encodeSource(code)}`;

    try {
        await PowerPoint.run(async (context) => {
            const selection = context.presentation.getSelectedShapes();
            const selectedSlides = context.presentation.getSelectedSlides();
            const allSlides = context.presentation.slides;
            selection.load("items");
            selectedSlides.load("items");
            allSlides.load("items");
            await context.sync();

            const count = selection.items.length;
            debug("Selected shapes:", count);

            let targetLeft = null;
            let targetTop = null;
            let replacing = false;

            if (count > 0) {
                const selected = selection.items[0];
                selected.load(["altTextDescription", "left", "top"]);
                await context.sync();

                if (selected.altTextDescription && selected.altTextDescription.startsWith("TYPST:")) {
                    targetLeft = selected.left;
                    targetTop = selected.top;
                    selected.delete();
                    replacing = true;
                    await context.sync();
                }
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
            const existingIds = new Set(targetSlide.shapes.items.map((s) => s.id));
            debug("Target slide chosen for insertion", targetSlideId);

            // Insert via setSelectedDataAsync; after insertion, tag the shape
            Office.context.document.setSelectedDataAsync(
                svgOutput,
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
                            const newShapes = slide.shapes.items.filter((s) => !existingIds.has(s.id));
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
                        const size = computeSizeFromSvg(svgOutput);
                        shapeToTag.width = size.width;
                        shapeToTag.height = size.height;
                        if (targetLeft !== null && targetTop !== null) {
                            shapeToTag.left = targetLeft;
                            shapeToTag.top = targetTop;
                        }
                        await ctx2.sync();
                        debug("Inserted/updated shape tagged", { replacing, targetLeft, targetTop, size, shapeId: shapeToTag.id });
                        setStatus(replacing ? "Updated Typst SVG." : "Inserted Typst SVG.");
                    });
                }
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
        shapes.load("items/altTextDescription");
        await context.sync();
        const count = shapes.items.length;
        debug("Selection changed, count:", count);

        if (count >= 1) {
            const match = shapes.items.find((s) => s.altTextDescription && s.altTextDescription.startsWith("TYPST:"));
            if (!match || !match.altTextDescription) {
                debug("No TYPST payload on selection");
                return;
            }
            const raw = match.altTextDescription.split("TYPST:")[1];
            try {
                document.getElementById('typstInput').value = decodeSource(raw);
                debug("Loaded Typst payload from selection");
            } catch (err) {
                console.error("Decode error:", err);
                setStatus("Failed to decode Typst payload from selection.", true);
            }
        }
    });
}

document.getElementById('insertBtn').onclick = handleAction;
