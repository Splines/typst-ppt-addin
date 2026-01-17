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

export type TypstShapeInfo = {
  payload: string;
  fontSize: string;
  fillColor: string | null;
  mathMode: boolean;
  position?: { left: number; top: number };
  rotation?: number;
  size: { width: number; height: number };
};

/**
 * Writes shape properties and Typst metadata to a given shape.
 */
export async function writeShapeProperties(shape: PowerPoint.Shape, info: TypstShapeInfo,
  context: PowerPoint.RequestContext) {
  shape.altTextDescription = info.payload;
  shape.name = SHAPE_CONFIG.NAME;
  shape.tags.add(SHAPE_CONFIG.TAGS.FONT_SIZE, info.fontSize);
  shape.tags.add(SHAPE_CONFIG.TAGS.FILL_COLOR,
    info.fillColor === null ? FILL_COLOR_DISABLED : info.fillColor);
  shape.tags.add(SHAPE_CONFIG.TAGS.MATH_MODE, info.mathMode.toString());

  if (info.size.height > 0 && info.size.width > 0) {
    shape.height = info.size.height;
    shape.width = info.size.width;
  }

  if (info.position) {
    shape.left = info.position.left;
    shape.top = info.position.top;
  }

  if (info.rotation) {
    shape.rotation = info.rotation;
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
