import { FILL_COLOR_DISABLED, SHAPE_CONFIG, DEFAULTS } from "./constants.js";
import { extractTypstCode, isTypstPayload } from "./payload.js";
import { updatePreview, updateButtonState, restoreMathModeFromStorage, updateMathModeVisuals } from "./preview.js";
import { readShapeTag, setLastTypstId } from "./shape.js";
import { setButtonText, setFillColor, setFontSize, setMathModeEnabled, setStatus, setTypstCode, setBulkUpdateButtonVisible } from "./ui.js";
import { debug } from "./utils/logger.js";

/**
 * Handles selection change events.
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
        shape.load(["id", "altTextDescription", "left", "top",
          "width", "height", "rotation", "tags"]),
      );
      await context.sync();
    }

    if (shapes.items.length === 0) {
      setLastTypstId(null);
      setButtonText(false);
      setBulkUpdateButtonVisible(false);
      restoreMathModeFromStorage();
      return;
    }

    const typstShapes = shapes.items.filter(shape =>
      isTypstPayload(shape.altTextDescription),
    );

    if (typstShapes.length > 1) {
      // Multiple Typst shapes selected - show bulk update button
      setBulkUpdateButtonVisible(true);
      setButtonText(true);
      setLastTypstId(null);
      restoreMathModeFromStorage();
    } else if (typstShapes.length === 1) {
      // Single Typst shape selected - load it for editing
      const typstShape = typstShapes[0];
      const slideId = slides.items.length > 0 ? slides.items[0].id : null;
      await loadTypstShape(typstShape, slideId, context);
      setButtonText(true);
      setBulkUpdateButtonVisible(false);
    } else {
      // No Typst shapes selected
      setLastTypstId(null);
      setButtonText(false);
      setBulkUpdateButtonVisible(false);
      restoreMathModeFromStorage();
    }
  });
}

/**
 * Loads Typst shape data into the UI state.
 */
async function loadTypstShape(typstShape: PowerPoint.Shape, slideId: string | null,
  context: PowerPoint.RequestContext) {
  try {
    const typstCode = extractTypstCode(typstShape.altTextDescription);
    const storedFontSize = await readShapeTag(typstShape, SHAPE_CONFIG.TAGS.FONT_SIZE, context);
    const storedFillColor = await readShapeTag(typstShape, SHAPE_CONFIG.TAGS.FILL_COLOR, context);
    const storedMathMode = await readShapeTag(typstShape, SHAPE_CONFIG.TAGS.MATH_MODE, context);

    setFontSize(storedFontSize || DEFAULTS.FONT_SIZE);
    const actualColor = await detectFillColor(typstShape, context);
    let fillColorToSet;
    if (actualColor) {
      fillColorToSet = actualColor;
    } else if (storedFillColor === FILL_COLOR_DISABLED || !storedFillColor) {
      fillColorToSet = null;
    } else {
      fillColorToSet = storedFillColor;
    }

    setFillColor(fillColorToSet);
    setTypstCode(typstCode);
    setMathModeEnabled(storedMathMode === "true");
    updateMathModeVisuals();
    setLastTypstId({ slideId, shapeId: typstShape.id });

    updateButtonState();
    void updatePreview();
  } catch (error) {
    console.error("Decode error:", error);
    setStatus("Failed to decode Typst payload from selection.", true);
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
