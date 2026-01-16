/**
 * Parses SVG string and extracts dimensions, ensuring content isn't clipped.
 *
 * @param svg SVG content as string
 * @returns SVG element and computed size
 */
export function parseAndApplySize(svg: string):
{ svgElement: SVGElement; size: { width: number; height: number } } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  const svgElement = doc.documentElement as unknown as SVGGraphicsElement;

  // Temporarily insert into DOM to measure actual content bounds
  const tempContainer = document.createElement("div");
  tempContainer.style.position = "absolute";
  tempContainer.style.visibility = "hidden";
  tempContainer.style.pointerEvents = "none";
  document.body.appendChild(tempContainer);
  tempContainer.appendChild(svgElement);

  let bbox;
  try {
    bbox = svgElement.getBBox();
  } catch {
    document.body.removeChild(tempContainer);
    const width = parseFloat(svgElement.getAttribute("width") || "400");
    const height = parseFloat(svgElement.getAttribute("height") || "250");
    return { svgElement, size: { width, height } };
  }

  document.body.removeChild(tempContainer);

  // Add some minor padding to avoid clipping
  const padding = Math.max(bbox.width, bbox.height) * 0.04;
  const x = bbox.x - padding;
  const y = bbox.y - padding;
  const width = bbox.width + 2 * padding;
  const height = bbox.height + 2 * padding;

  // Set viewBox to actual content bounds with padding
  svgElement.setAttribute("viewBox", `${x.toString()} ${y.toString()} ${width.toString()} ${height.toString()}`);
  svgElement.setAttribute("width", width.toString());
  svgElement.setAttribute("height", height.toString());

  return { svgElement, size: { width, height } };
}

/**
 * Applies fill color to all elements in an SVG element.
 */
export function applyFillColor(svg: SVGElement, fillColor: string) {
  const elements = svg.querySelectorAll("*");
  elements.forEach((el) => {
    const fill = el.getAttribute("fill");
    if (fill && fill.toLowerCase() !== "none") {
      el.setAttribute("fill", fillColor);
    }
    const stroke = el.getAttribute("stroke");
    if (stroke && stroke.toLowerCase() !== "none") {
      el.setAttribute("stroke", fillColor);
    }
  });
}
