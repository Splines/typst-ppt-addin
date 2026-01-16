import { debug } from "./utils";

/**
 * Applies explicit width and height attributes to an SVG element.
 *
 * @param svg SVG content as string
 * @returns Modified SVG and computed size
 */
export function applySize(svg: string):
{ svg: string; size: { width: number; height: number } } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  const svgElement = doc.documentElement as unknown as SVGGraphicsElement;

  const tempContainer = document.createElement("div");
  tempContainer.style.position = "absolute";
  tempContainer.style.visibility = "hidden";
  tempContainer.style.width = "0";
  tempContainer.style.height = "0";
  document.body.appendChild(tempContainer);
  tempContainer.appendChild(svgElement);

  const actualBounds = calcBoundingBox(svgElement);

  document.body.removeChild(tempContainer);

  if (actualBounds && actualBounds.width > 0 && actualBounds.height > 0) {
    svgElement.setAttribute("viewBox",
      `${actualBounds.x.toString()} ${actualBounds.y.toString()} ${actualBounds.width.toString()} ${actualBounds.height.toString()}`,
    );

    const aspectRatio = actualBounds.width / actualBounds.height;
    const height = actualBounds.height;
    const width = height * aspectRatio;

    svgElement.setAttribute("height", height.toString());
    svgElement.setAttribute("width", width.toString());

    const serializer = new XMLSerializer();
    const modifiedSvg = serializer.serializeToString(svgElement);

    return { svg: modifiedSvg, size: { width, height } };
  }

  const viewBoxAttr = svgElement.getAttribute("viewBox");
  if (!viewBoxAttr) {
    return { svg, size: computeSizeFromSvg(svg) };
  }

  const parts = viewBoxAttr.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts[2] <= 0 || parts[3] <= 0) {
    return { svg, size: computeSizeFromSvg(svg) };
  }

  const aspectRatio = parts[2] / parts[3];
  const height = parts[3];
  const width = height * aspectRatio;

  svgElement.setAttribute("height", height.toString());
  svgElement.setAttribute("width", width.toString());

  const serializer = new XMLSerializer();
  const modifiedSvg = serializer.serializeToString(svgElement);

  return { svg: modifiedSvg, size: { width, height } };
}

/**
 * Calculates the actual bounding box of SVG content including a small padding.
 *
 * @param svg The SVG element to measure
 * @returns Bounding box or null
 */
function calcBoundingBox(svg: SVGGraphicsElement):
{ x: number; y: number; width: number; height: number } | null {
  const bbox = svg.getBBox();
  const padding = Math.max(bbox.width, bbox.height) * 0.1;

  return {
    x: bbox.x - padding,
    y: bbox.y - padding,
    width: bbox.width + 2 * padding,
    height: bbox.height + 2 * padding,
  };
}

/**
 * Computes the size of an SVG from its viewBox attribute
 * @param svg SVG content
 * @param scale Scale factor to apply
 * @param fallbackWidth Width to use if viewBox not found
 * @returns Computed dimensions
 */
export function computeSizeFromSvg(svg: string, scale = 1.0, fallbackWidth = 300): { width: number; height: number } {
  const viewBoxPattern = /viewBox\s*=\s*["']\s*([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s*["']/i;
  const match = viewBoxPattern.exec(svg);

  if (match) {
    const [, , , viewBoxWidth, viewBoxHeight] = match.map(Number);
    if (viewBoxWidth > 0 && viewBoxHeight > 0) {
      return { width: viewBoxWidth * scale, height: viewBoxHeight * scale };
    }
  }

  return { width: fallbackWidth, height: fallbackWidth * 0.6 };
}

/**
 * Applies fill color to all elements in an SVG string.
 */
export function applyFillColorToSvgString(svg: string, fillColor: string | null) {
  if (fillColor === null) {
    // user wants to use no color at all, or the color from Typst code
    return svg;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const svgElement = doc.documentElement as unknown as SVGElement;

    applyFillColor(svgElement, fillColor);

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgElement);
  } catch (error) {
    debug("applyFillColorToSvg failed", error);
    return svg;
  }
}

/**
 * Applies fill color to all elements in an SVG element.
 */
export function applyFillColor(svg: SVGElement, fillColor: string) {
  const fillable = svg.querySelectorAll("path, circle, rect, ellipse, polygon, polyline, text");
  fillable.forEach((el) => {
    el.setAttribute("fill", fillColor);
  });
}
