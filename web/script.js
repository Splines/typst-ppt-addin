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
let lastTypstSelection = null; // { slideId, shapeId, left, top, width, height }

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

            // Load props on selected shapes
            if (selection.items.length > 0) {
                selection.items.forEach((s) => s.load(["id", "altTextDescription", "left", "top", "width", "height"]));
                await context.sync();
            }

            const count = selection.items.length;
            debug("Selected shapes:", count);

            let targetLeft = null;
            let targetTop = null;
            let targetWidth = null;
            let targetHeight = null;
            let replacing = false;

            // Try current selection first
            let typstShape = selection.items.find(
                (s) => s.altTextDescription && s.altTextDescription.startsWith("TYPST:")
            );

            // If nothing is selected (because taskpane grabbed focus), fall back to last remembered Typst selection
            if (!typstShape && lastTypstSelection) {
                try {
                    const slide = allSlides.items.find((sl) => sl.id === lastTypstSelection.slideId) || allSlides.items[0];
                    if (slide) {
                        slide.shapes.load("items");
                        await context.sync();
                        if (slide.shapes.items.length > 0) {
                            slide.shapes.items.forEach((s) => s.load(["id", "altTextDescription", "left", "top", "width", "height"]));
                            await context.sync();
                            typstShape = slide.shapes.items.find((s) => s.id === lastTypstSelection.shapeId);
                        }
                    }
                } catch (e) {
                    debug("Fallback to last selection failed:", e);
                }
            }

            if (typstShape) {
                targetLeft = typstShape.left;
                targetTop = typstShape.top;
                targetWidth = typstShape.width;
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
                        const h = targetHeight ?? size.height;
                        const aspect = size.height > 0 ? size.width / size.height : 1;
                        shapeToTag.height = h;
                        shapeToTag.width = h * aspect;
                        if (targetLeft !== null && targetTop !== null) {
                            shapeToTag.left = targetLeft;
                            shapeToTag.top = targetTop;
                        }
                        await ctx2.sync();
                        debug("Inserted/updated shape tagged", { replacing, targetLeft, targetTop, size, shapeId: shapeToTag.id, targetWidth, targetHeight });
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
        shapes.load("items");
        const slides = context.presentation.getSelectedSlides();
        slides.load("items/id");
        await context.sync();
        if (shapes.items.length > 0) {
            shapes.items.forEach((s) => s.load(["id", "altTextDescription", "left", "top", "width", "height"]));
            await context.sync();
        }
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
                const slideId = slides.items.length > 0 ? slides.items[0].id : null;
                lastTypstSelection = {
                    slideId,
                    shapeId: match.id,
                    left: match.left,
                    top: match.top,
                    width: match.width,
                    height: match.height,
                };
            } catch (err) {
                console.error("Decode error:", err);
                setStatus("Failed to decode Typst payload from selection.", true);
            }
        }
    });
}

document.getElementById('insertBtn').onclick = handleAction;
