import { debug } from "./utils/logger.js";
import { applyFillColor, parseAndApplySize } from "./svg.js";
import { lastTypstForm, storeValue, TypstForm } from "./state.js";
import { typst } from "./typst.js";
import { setStatus, getFontSize, getFillColor, getTypstCode } from "./ui.js";
import { isTypstPayload, createTypstPayload } from "./payload.js";
import { SHAPE_CONFIG, FILL_COLOR_DISABLED, STORAGE_KEYS } from "./constants.js";

/**
 * Finds a Typst shape in the current selection or uses cached selection.
 */
async function findTypstShape(selectedShapes: PowerPoint.Shape[], allSlides: PowerPoint.Slide[],
  context: PowerPoint.RequestContext): Promise<PowerPoint.Shape | undefined> {
  const typstShape = selectedShapes.find(
    shape => isTypstPayload(shape.altTextDescription),
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
 * Tags a shape with Typst metadata.
 *
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
  shape.name = SHAPE_CONFIG.NAME;
  shape.tags.add(SHAPE_CONFIG.TAGS.FONT_SIZE, fontSize);
  shape.tags.add(SHAPE_CONFIG.TAGS.FILL_COLOR, fillColor === null ? FILL_COLOR_DISABLED : fillColor);

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
 * Finds the newly inserted shape on a slide.
 *
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
 * Inserts or updates a Typst formula in PowerPoint.
 */
export async function insertOrUpdateFormula() {
  const rawCode = getTypstCode();
  const fontSize = getFontSize();
  const fillColor = getFillColor();

  storeValue(STORAGE_KEYS.FONT_SIZE, fontSize);
  storeValue(STORAGE_KEYS.FILL_COLOR, fillColor);

  debug("Handle action start");
  const svgOutput = await typst(rawCode, fontSize);

  if (typeof svgOutput !== "string") {
    setStatus("Typst compile failed.", true);
    return;
  }

  try {
    await PowerPoint.run(async (context) => {
      const selection = context.presentation.getSelectedShapes();
      const selectedSlides = context.presentation.getSelectedSlides();
      const allSlides = context.presentation.slides;

      selection.load("items");
      selectedSlides.load("items");
      allSlides.load("items");
      await context.sync();

      const targetSlide = selectedSlides.items[0] || allSlides.items[0];
      if (targetSlide.isNullObject) {
        setStatus("No slide available to insert SVG.", true);
        return;
      }
      const slideId = targetSlide.id;
      targetSlide.load(["id", "shapes/items/id"]);
      await context.sync();

      if (selection.items.length > 0) {
        selection.items.forEach(shape =>
          shape.load(["id", "altTextDescription", "left", "top", "width", "height"]),
        );
        await context.sync();
      }

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
            const existingShapeIds = new Set(targetSlide.shapes.items.map(shape => shape.id));
            const shapeToTag = await findInsertedShape(slideId, existingShapeIds, ctx2);

            if (!shapeToTag) {
              console.warn("No shape found after insertion; cannot tag Typst payload.");
              setStatus("Inserted SVG but could not tag it (no selection).", true);
              return;
            }

            const payload = createTypstPayload(rawCode);
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
