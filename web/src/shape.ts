import { SHAPE_CONFIG, FILL_COLOR_DISABLED } from "./constants.js";
import { debug } from "./utils/logger.js";

export type TypstShapeId = {
  slideId: string | null;
  shapeId: string;
};

export let lastTypstShapeId: TypstShapeId | null;

/**
 * Updates the last Typst shape identifier.
 */
export function setLastTypstId(info: TypstShapeId | null) {
  lastTypstShapeId = info;
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
export async function tagShape(shape: PowerPoint.Shape, payload: string, fontSize: string,
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
 * Reads a tag value from a shape.
 */
export async function readShapeTag(
  shape: PowerPoint.Shape,
  tagName: string,
  context: PowerPoint.RequestContext,
): Promise<string | null> {
  try {
    const tag = shape.tags.getItemOrNullObject(tagName);
    tag.load("value");
    await context.sync();
    return tag.isNullObject ? null : tag.value;
  } catch (error) {
    debug(`Error reading tag ${tagName}:`, error);
    return null;
  }
}
