import { debug } from "./utils/logger.js";
import { applyFillColor, parseAndApplySize } from "./svg.js";
import { typst } from "./typst.js";
import { setStatus, getFontSize, getFillColor, getTypstCode } from "./ui.js";
import { isTypstPayload, createTypstPayload } from "./payload.js";
import { storeValue } from "./utils/storage.js";
import { lastTypstShapeId, TypstShapeInfo, writeShapeProperties } from "./shape.js";
import { STORAGE_KEYS } from "./constants.js";

/**
 * Inserts or updates a Typst formula in PowerPoint.
 */
export async function insertOrUpdateFormula() {
  const rawCode = getTypstCode();
  const fontSize = getFontSize();
  const fillColor = getFillColor();
  storeValue(STORAGE_KEYS.FONT_SIZE, fontSize);
  storeValue(STORAGE_KEYS.FILL_COLOR, fillColor);

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

      const targetSlide: PowerPoint.Slide | undefined = selectedSlides.items[0] || allSlides.items[0];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!targetSlide || targetSlide.isNullObject) {
        setStatus("No slide available to insert SVG.", true);
        return;
      }
      targetSlide.load(["id", "shapes/items/id"]);
      await context.sync();

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
      const payload = createTypstPayload(rawCode);
      createTypstShape(preparedSvg, targetSlide, isReplacing, {
        payload,
        fontSize,
        fillColor,
        position,
        size,
      });
    });
  } catch (error) {
    console.error("PowerPoint context error:", error);
    setStatus("PowerPoint API error. See console.", true);
  }
}

function createTypstShape(svg: string, targetSlide: PowerPoint.Slide,
  isReplacing: boolean, info: TypstShapeInfo) {
  Office.context.document.setSelectedDataAsync(svg, { coercionType: Office.CoercionType.XmlSvg }, (result) => {
    if (result.status !== Office.AsyncResultStatus.Succeeded) {
      console.error("Insert failed:", result.error);
      setStatus("Failed to insert SVG into the slide.", true);
      return;
    }

    void PowerPoint.run(async (context2) => {
      const existingShapeIds = new Set(targetSlide.shapes.items.map(shape => shape.id));
      const shapeToTag = await findInsertedShape(targetSlide.id, existingShapeIds, context2);

      if (!shapeToTag) {
        console.warn("No shape found after insertion; cannot tag Typst payload.");
        setStatus("Inserted SVG but could not tag it (no selection).", true);
        return;
      }

      await writeShapeProperties(shapeToTag, info, context2);
      setStatus(isReplacing ? "Updated Typst SVG." : "Inserted Typst SVG.");
    });
  },
  );
}

/**
 * Finds a Typst shape in the current selection or uses cached selection.
 */
async function findTypstShape(selectedShapes: PowerPoint.Shape[], allSlides: PowerPoint.Slide[],
  context: PowerPoint.RequestContext): Promise<PowerPoint.Shape | undefined> {
  const typstShape = selectedShapes.find(
    shape => isTypstPayload(shape.altTextDescription),
  );
  if (typstShape) return typstShape;

  if (!lastTypstShapeId) return undefined;
  const id = lastTypstShapeId;

  try {
    const targetSlide = allSlides.find(slide => slide.id === id.slideId) || allSlides[0];
    if (targetSlide.isNullObject) return undefined;

    targetSlide.shapes.load("items");
    await context.sync();
    if (targetSlide.shapes.items.length === 0) return undefined;

    return targetSlide.shapes.items.find(shape => shape.id === id.shapeId);
  } catch (error) {
    debug("Fallback to last selection failed:", error);
    return undefined;
  }
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
