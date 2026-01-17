import { debug } from "./utils/logger.js";
import { applyFillColor, parseAndApplySize } from "./svg.js";
import { typst } from "./typst.js";
import { setStatus, getFontSize, getFillColor, getTypstCode } from "./ui.js";
import { isTypstPayload, createTypstPayload, extractTypstCode } from "./payload.js";
import { storeValue } from "./utils/storage.js";
import { lastTypstShapeId, TypstShapeInfo, writeShapeProperties, readShapeTag } from "./shape.js";
import { STORAGE_KEYS, SHAPE_CONFIG, FILL_COLOR_DISABLED } from "./constants.js";

type PreparedSvgResult = {
  svg: string;
  size: { width: number; height: number };
  payload: string;
};

/**
 * Compiles Typst code to SVG and prepares it for insertion.
 */
async function prepareTypstSvg(
  typstCode: string,
  fontSize: string,
  fillColor: string | null,
): Promise<PreparedSvgResult | null> {
  const svgOutput = await typst(typstCode, fontSize);

  if (typeof svgOutput !== "string") {
    return null;
  }

  const { svgElement, size } = parseAndApplySize(svgOutput);
  if (fillColor) {
    applyFillColor(svgElement, fillColor);
  }

  const serializer = new XMLSerializer();
  const svg = serializer.serializeToString(svgElement);
  const payload = createTypstPayload(typstCode);

  return { svg, size, payload };
}

/**
 * Inserts SVG into PowerPoint and tags it with Typst metadata.
 *
 * @returns the newly inserted shape or null if insertion fails.
 */
async function insertSvgAndTag(
  svg: string,
  info: TypstShapeInfo,
  targetSlideId: string,
  existingShapeIds: Set<string>,
): Promise<PowerPoint.Shape | null> {
  return new Promise<PowerPoint.Shape | null>((resolve) => {
    Office.context.document.setSelectedDataAsync(svg, { coercionType: Office.CoercionType.XmlSvg }, (result) => {
      if (result.status !== Office.AsyncResultStatus.Succeeded) {
        console.error("Insert failed:", result.error);
        resolve(null);
        return;
      }

      void PowerPoint.run(async (context) => {
        const shapeToTag = await findInsertedShape(targetSlideId, existingShapeIds, context);

        if (!shapeToTag) {
          console.warn("No shape found after insertion; cannot tag Typst payload.");
          resolve(null);
          return;
        }

        await writeShapeProperties(shapeToTag, info, context);
        resolve(shapeToTag);
      });
    });
  });
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

  const prepared = await prepareTypstSvg(rawCode, fontSize, fillColor);
  if (!prepared) {
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
        position = calculateCenteredPosition(typstShape, prepared.size);
        typstShape.delete();
        isReplacing = true;
        await context.sync();
      } else {
        position = await calcShapeTopLeftToBeCentered(prepared.size, context);
      }

      const existingShapeIds = new Set(targetSlide.shapes.items.map(shape => shape.id));
      const insertedShape = await insertSvgAndTag(prepared.svg, {
        payload: prepared.payload,
        fontSize,
        fillColor: fillColor || null,
        position,
        size: prepared.size,
      }, targetSlide.id, existingShapeIds);

      if (!insertedShape) {
        setStatus("Failed to insert SVG into the slide.", true);
        return;
      }

      setStatus(isReplacing ? "Updated Typst SVG." : "Inserted Typst SVG.");
    });
  } catch (error) {
    console.error("PowerPoint context error:", error);
    setStatus("PowerPoint API error. See console.", true);
  }
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

/**
 * Updates font size for all selected Typst shapes.
 */
export async function bulkUpdateFontSize() {
  const newFontSize = getFontSize();
  storeValue(STORAGE_KEYS.FONT_SIZE, newFontSize);

  try {
    await PowerPoint.run(async (context) => {
      const selection = context.presentation.getSelectedShapes();
      selection.load("items");
      await context.sync();

      const typstShapes = selection.items.filter(shape =>
        isTypstPayload(shape.altTextDescription),
      );

      if (typstShapes.length === 0) {
        setStatus("No Typst shapes selected.", true);
        return;
      }

      let successCount = 0;

      for (const shape of typstShapes) {
        try {
          const typstCode = extractTypstCode(shape.altTextDescription);
          const storedFillColor = await readShapeTag(shape, SHAPE_CONFIG.TAGS.FILL_COLOR, context);

          const fillColor = !storedFillColor || storedFillColor === FILL_COLOR_DISABLED
            ? null
            : storedFillColor;

          const prepared = await prepareTypstSvg(typstCode, newFontSize, fillColor);
          if (!prepared) {
            debug(`Typst compile failed for shape ${shape.id}`);
            continue;
          }

          const position = calculateCenteredPosition(shape, prepared.size);

          // Capture slide and existing shapes before deletion
          const parentSlide = shape.getParentSlide();
          parentSlide.load("id");
          parentSlide.shapes.load("items/id");
          await context.sync();
          const existingShapeIds = new Set(parentSlide.shapes.items.map((s: PowerPoint.Shape) => s.id));
          const slideId = parentSlide.id;

          shape.delete();
          await context.sync();

          const insertedShape = await insertSvgAndTag(prepared.svg, {
            payload: prepared.payload,
            fontSize: newFontSize,
            fillColor,
            position,
            size: prepared.size,
          }, slideId, existingShapeIds);

          if (insertedShape) {
            successCount++;
          }
        } catch (error) {
          debug(`Error updating shape ${shape.id}:`, error);
        }
      }

      setStatus(`Updated ${successCount.toString()} of ${typstShapes.length.toString()} Typst shapes with font size ${newFontSize}.`);
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    setStatus("Error updating Typst shapes. See console.", true);
  }
}

/**
 * Calculates the position to center a new shape on an old shape's center point.
 */
function calculateCenteredPosition(
  oldShape: { left: number; top: number; width: number; height: number },
  newSize: { width: number; height: number },
): { left: number; top: number } {
  const centerX = oldShape.left + oldShape.width / 2;
  const centerY = oldShape.top + oldShape.height / 2;
  return {
    left: centerX - newSize.width / 2,
    top: centerY - newSize.height / 2,
  };
}

/**
 * Calculates the top-left position for a shape to be centered on the slide.
 */
async function calcShapeTopLeftToBeCentered(
  shapeSize: { width: number; height: number },
  context: PowerPoint.RequestContext,
) {
  const presentation = context.presentation;
  presentation.load("pageSetup/slideWidth, pageSetup/slideHeight");
  await context.sync();

  const centerX = (presentation.pageSetup.slideWidth - shapeSize.width) / 2;
  const centerY = (presentation.pageSetup.slideHeight - shapeSize.height) / 2;

  return { left: centerX, top: centerY };
}
