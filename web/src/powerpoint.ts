import { encodeSource, decodeSource, debug } from "./utils.js";
import { applyFillColor, parseAndApplySize } from "./svg.js";
import { lastTypstForm, setLastTypstForm, storeValue, TypstForm } from "./state.js";
import { typst } from "./typst.js";
import { setStatus, getFontSize, getFillColor, getTypstCode, setTypstCode, setFontSize, setFillColor, setButtonText, updatePreview } from "./ui.js";

/**
 * Finds a Typst shape in the current selection or uses cached selection.
 */
async function findTypstShape(selectedShapes: PowerPoint.Shape[], allSlides: PowerPoint.Slide[],
  context: PowerPoint.RequestContext): Promise<PowerPoint.Shape | undefined> {
  const typstShape = selectedShapes.find(
    shape => shape.altTextDescription && shape.altTextDescription.startsWith("TYPST:"),
  );
  if (typstShape) return typstShape;

  if (!lastTypstForm) return undefined;

  try {
    const targetSlide = allSlides.find(slide => slide.id === (lastTypstForm as TypstForm).slideId) || allSlides[0];
    if (targetSlide.isNullObject) return undefined;

    targetSlide.shapes.load("items");
    await context.sync();

    if (targetSlide.shapes.items.length === 0) return undefined;

    targetSlide.shapes.items.forEach(shape =>
      shape.load(["id", "altTextDescription", "left", "top", "width", "height"]),
    );
    await context.sync();

    return targetSlide.shapes.items.find(shape => shape.id === (lastTypstForm as TypstForm).shapeId);
  } catch (error) {
    debug("Fallback to last selection failed:", error);
    return undefined;
  }
}

/**
 * Tags a shape with Typst metadata
 * @param shape PowerPoint shape object
 * @param payload Encoded Typst source
 * @param fontSize Font size value
 * @param fillColor Fill color value or null if disabled
 * @param position Position with left and top properties
 * @param size Size with width and height properties
 * @param context PowerPoint (Office) context
 */
async function tagShape(shape: PowerPoint.Shape, payload: string, fontSize: string,
  fillColor: string | null, position: { left: number; top: number } | null,
  size: { width: number; height: number }, context: PowerPoint.RequestContext) {
  shape.altTextDescription = payload;
  shape.name = "Typst Equation";
  shape.tags.add("TypstFontSize", fontSize);
  shape.tags.add("TypstFillColor", fillColor === null ? "disabled" : fillColor);

  if (size.height > 0 && size.width > 0) {
    shape.height = size.height;
    shape.width = size.width;
  }

  if (position) {
    shape.left = position.left;
    shape.top = position.top;
  }

  await context.sync();
}

/**
 * Finds the newly inserted shape on a slide
 * @param slideId Target slide ID
 * @param existingShapeIds IDs of shapes before insertion
 * @param context PowerPoint context
 * @returns The new shape or null
 */
async function findInsertedShape(slideId: string, existingShapeIds: Set<string>,
  context: PowerPoint.RequestContext): Promise<PowerPoint.Shape | null> {
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
    debug("Shape diff fallback failed", error);
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

  debug("Handle action start");
  const svgOutput = await typst(rawCode, fontSize);

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

      const targetSlide = selectedSlides.items[0] || allSlides.items[0];
      if (targetSlide.isNullObject) {
        setStatus("No slide available to insert SVG.", true);
        return;
      }

      targetSlide.load(["id", "shapes/items/id"]);
      await context.sync();

      const slideId = targetSlide.id;
      const existingShapeIds = new Set(targetSlide.shapes.items.map(shape => shape.id));

      let position: { left: number; top: number } | null = null;
      let isReplacing = false;

      const typstShape = await findTypstShape(selection.items, allSlides.items, context);

      if (typstShape) {
        position = { left: typstShape.left, top: typstShape.top };
        typstShape.delete();
        isReplacing = true;
        await context.sync();
      }

      const { svgElement, size } = parseAndApplySize(svgOutput);
      if (fillColor) {
        applyFillColor(svgElement, fillColor);
      }
      const serializer = new XMLSerializer();
      const preparedSvg = serializer.serializeToString(svgElement);

      Office.context.document.setSelectedDataAsync(
        preparedSvg,
        { coercionType: Office.CoercionType.XmlSvg },
        (result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            console.error("Insert failed:", result.error);
            setStatus("Failed to insert SVG into the slide.", true);
            return;
          }

          void PowerPoint.run(async (ctx2) => {
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
 * Reads the font size tag from a shape.
 */
async function readFontSizeTag(shape: PowerPoint.Shape,
  context: PowerPoint.RequestContext): Promise<string | null> {
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
 * Reads the fill color tag from a shape.
 */
async function readFillColorTag(shape: PowerPoint.Shape,
  context: PowerPoint.RequestContext): Promise<string | null> {
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
 * Extracts the actual fill color from a shape's fill property.
 *
 * There is an Office API bug where the fill color is always black if the user
 * uses any "Theme Color" as shape fill:
 * https://github.com/OfficeDev/office-js/issues/6443
 */
async function detectFillColor(shape: PowerPoint.Shape,
  context: PowerPoint.RequestContext): Promise<string | null> {
  try {
    shape.fill.load(["foregroundColor"]);
    await context.sync();
    const color = shape.fill.foregroundColor;
    return color;
  } catch (error) {
    debug("Could not extract fill color from shape fill property: ", error);
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

          const actualColor = await detectFillColor(typstShape, context);

          let fillColorToSet;
          if (actualColor) {
            fillColorToSet = actualColor;
            debug("Using detected color from shape:", actualColor);
          } else if (storedFillColor === "disabled" || !storedFillColor) {
            fillColorToSet = null;
          } else {
            fillColorToSet = storedFillColor;
          }

          setFillColor(fillColorToSet);
          setTypstCode(decodedCode);

          debug("Loaded Typst payload from selection");

          const slideId = slides.items.length > 0 ? slides.items[0].id : null;
          setLastTypstForm({
            slideId,
            shapeId: typstShape.id,
            left: typstShape.left,
            top: typstShape.top,
            width: typstShape.width,
            height: typstShape.height,
          });

          void updatePreview();
        } catch (error) {
          console.error("Decode error:", error);
          setStatus("Failed to decode Typst payload from selection.", true);
        }
      } else {
        debug("No TYPST payload on selection");
      }
    }

    if (!isTypstShape) {
      setLastTypstForm(null);
    }

    setButtonText(isTypstShape);
  });
}
