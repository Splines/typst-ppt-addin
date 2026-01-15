import { encodeSource, decodeSource, applySizeToSvg, applyFillColorToSvg, debug, buildTypstCode } from "./utils.js";
import { state, setLastTypstSelection, storeValue } from "./state.js";
import { compile } from "./compiler.js";
import { setStatus, getFontSize, getFillColor, getTypstCode, setTypstCode, setFontSize, setFillColor, setButtonText, updatePreview } from "./ui.js";

/**
 * Finds a Typst shape in the current selection or uses cached selection
 * @param {Array} selectedShapes - Currently selected shapes
 * @param {Array} allSlides - All presentation slides
 * @param {Object} context - PowerPoint context
 * @returns {Promise<Object|null>} Typst shape or null
 */
async function findTypstShape(selectedShapes, allSlides, context) {
  let typstShape = selectedShapes.find(
    shape => shape.altTextDescription && shape.altTextDescription.startsWith("TYPST:"),
  );

  if (typstShape || !state.lastTypstSelection) {
    return typstShape;
  }

  try {
    const targetSlide = allSlides.find(slide => slide.id === state.lastTypstSelection.slideId) || allSlides[0];
    if (!targetSlide) return null;

    targetSlide.shapes.load("items");
    await context.sync();

    if (targetSlide.shapes.items.length === 0) return null;

    targetSlide.shapes.items.forEach(shape =>
      shape.load(["id", "altTextDescription", "left", "top", "width", "height"]),
    );
    await context.sync();

    return targetSlide.shapes.items.find(shape => shape.id === state.lastTypstSelection.shapeId);
  } catch (error) {
    debug("Fallback to last selection failed:", error);
    return null;
  }
}

/**
 * Tags a shape with Typst metadata
 * @param {Object} shape - PowerPoint shape object
 * @param {string} payload - Encoded Typst source
 * @param {string} fontSize - Font size value
 * @param {string} fillColor - Fill color value
 * @param {Object} position - Position with left and top properties
 * @param {Object} size - Size with width and height properties
 * @param {Object} context - PowerPoint context
 */
async function tagShape(shape, payload, fontSize, fillColor, position, size, context) {
  shape.altTextDescription = payload;
  shape.name = "Typst Equation";
  shape.tags.add("TypstFontSize", fontSize.toString());
  shape.tags.add("TypstFillColor", fillColor);

  if (size.height > 0 && size.width > 0) {
    shape.height = size.height;
    shape.width = size.width;
  }

  if (position.left !== null && position.top !== null) {
    shape.left = position.left;
    shape.top = position.top;
  }

  await context.sync();
}

/**
 * Finds the newly inserted shape on a slide
 * @param {string} slideId - Target slide ID
 * @param {Set} existingShapeIds - IDs of shapes before insertion
 * @param {Object} context - PowerPoint context
 * @returns {Promise<Object|null>} The new shape or null
 */
async function findInsertedShape(slideId, existingShapeIds, context) {
  try {
    const slide = context.presentation.slides.getItem(slideId);
    slide.shapes.load("items/id");
    await context.sync();

    const newShapes = slide.shapes.items.filter(shape => !existingShapeIds.has(shape.id));
    if (newShapes.length > 0) {
      return newShapes[newShapes.length - 1];
    }

    if (slide.shapes.items.length > 0) {
      return slide.shapes.items[slide.shapes.items.length - 1];
    }
  } catch (error) {
    debug("Shape diff fallback failed:", error);
  }

  const postShapes = context.presentation.getSelectedShapes();
  postShapes.load("items");
  await context.sync();

  return postShapes.items.length > 0 ? postShapes.items[postShapes.items.length - 1] : null;
}

/**
 * Inserts or updates a Typst formula in PowerPoint
 */
export async function insertOrUpdateFormula() {
  const rawCode = getTypstCode();
  const fontSize = getFontSize();
  const fillColor = getFillColor();

  storeValue("typstFontSize", fontSize);
  storeValue("typstFillColor", fillColor);

  const fullCode = buildTypstCode(rawCode, fontSize);

  debug("Handle action start");
  const svgOutput = await compile(fullCode);

  if (typeof svgOutput !== "string" || svgOutput.startsWith("Error:")) {
    setStatus(svgOutput || "Typst compile failed.", true);
    return;
  }

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

      if (selection.items.length > 0) {
        selection.items.forEach(shape =>
          shape.load(["id", "altTextDescription", "left", "top", "width", "height"]),
        );
        await context.sync();
      }

      debug("Selected shapes:", selection.items.length);

      const position = { left: null, top: null };
      let isReplacing = false;

      const typstShape = await findTypstShape(selection.items, allSlides.items, context);

      if (typstShape) {
        position.left = typstShape.left;
        position.top = typstShape.top;
        typstShape.delete();
        isReplacing = true;
        await context.sync();
      }

      const targetSlide = selectedSlides.items[0] || allSlides.items[0];
      if (!targetSlide) {
        setStatus("No slide available to insert SVG.", true);
        return;
      }

      targetSlide.load(["id", "shapes/items/id"]);
      await context.sync();

      const slideId = targetSlide.id;
      const existingShapeIds = new Set(targetSlide.shapes.items.map(shape => shape.id));

      debug("Target slide chosen for insertion", slideId);

      const { svg: sizedSvg, size } = applySizeToSvg(svgOutput, null);
      const preparedSvg = applyFillColorToSvg(sizedSvg, fillColor);

      Office.context.document.setSelectedDataAsync(
        preparedSvg,
        { coercionType: Office.CoercionType.XmlSvg },
        async (result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            console.error("Insert failed:", result.error);
            setStatus("Failed to insert SVG into the slide.", true);
            return;
          }

          await PowerPoint.run(async (ctx2) => {
            const shapeToTag = await findInsertedShape(slideId, existingShapeIds, ctx2);

            if (!shapeToTag) {
              console.warn("No shape found after insertion; cannot tag Typst payload.");
              setStatus("Inserted SVG but could not tag it (no selection).", true);
              return;
            }

            await tagShape(shapeToTag, payload, fontSize, fillColor, position, size, ctx2);

            debug("Inserted/updated shape tagged", {
              isReplacing,
              position,
              size,
              shapeId: shapeToTag.id,
            });
            setStatus(isReplacing ? "Updated Typst SVG." : "Inserted Typst SVG.");
          });
        },
      );
    });
  } catch (error) {
    console.error("PowerPoint context error:", error);
    setStatus("PowerPoint API error. See console.", true);
  }
}

/**
 * Reads the font size tag from a shape
 * @param {Object} shape - PowerPoint shape object
 * @param {Object} context - PowerPoint context
 * @returns {Promise<string|null>} Font size value or null
 */
async function readFontSizeTag(shape, context) {
  try {
    const tag = shape.tags.getItemOrNullObject("TypstFontSize");
    tag.load("value");
    await context.sync();

    return tag.isNullObject ? null : tag.value;
  } catch (error) {
    debug("Error reading tags", error);
    return null;
  }
}

/**
 * Reads the fill color tag from a shape
 * @param {Object} shape - PowerPoint shape object
 * @param {Object} context - PowerPoint context
 * @returns {Promise<string|null>} Fill color value or null
 */
async function readFillColorTag(shape, context) {
  try {
    const tag = shape.tags.getItemOrNullObject("TypstFillColor");
    tag.load("value");
    await context.sync();

    return tag.isNullObject ? null : tag.value;
  } catch (error) {
    debug("Error reading fill color tag", error);
    return null;
  }
}

/**
 * Handles selection change events in PowerPoint
 */
export async function handleSelectionChange() {
  await PowerPoint.run(async (context) => {
    const shapes = context.presentation.getSelectedShapes();
    const slides = context.presentation.getSelectedSlides();

    shapes.load("items");
    slides.load("items/id");
    await context.sync();

    if (shapes.items.length > 0) {
      shapes.items.forEach(shape =>
        shape.load(["id", "altTextDescription", "left", "top", "width", "height", "tags"]),
      );
      await context.sync();
    }

    debug("Selection changed, count:", shapes.items.length);

    let isTypstShape = false;

    if (shapes.items.length >= 1) {
      const typstShape = shapes.items.find(shape =>
        shape.altTextDescription && shape.altTextDescription.startsWith("TYPST:"),
      );

      if (typstShape && typstShape.altTextDescription) {
        isTypstShape = true;
        const base64Payload = typstShape.altTextDescription.split("TYPST:")[1];

        try {
          const decodedCode = decodeSource(base64Payload);
          const storedFontSize = await readFontSizeTag(typstShape, context);
          const storedFillColor = await readFillColorTag(typstShape, context);

          setFontSize(storedFontSize || "20");
          setFillColor(storedFillColor || "#000000");
          setTypstCode(decodedCode);

          debug("Loaded Typst payload from selection");

          const slideId = slides.items.length > 0 ? slides.items[0].id : null;
          setLastTypstSelection({
            slideId,
            shapeId: typstShape.id,
            left: typstShape.left,
            top: typstShape.top,
            width: typstShape.width,
            height: typstShape.height,
          });

          updatePreview();
        } catch (error) {
          console.error("Decode error:", error);
          setStatus("Failed to decode Typst payload from selection.", true);
        }
      } else {
        debug("No TYPST payload on selection");
      }
    }

    if (!isTypstShape) {
      setLastTypstSelection(null);
    }

    setButtonText(isTypstShape);
  });
}
