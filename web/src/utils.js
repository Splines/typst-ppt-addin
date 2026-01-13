/**
 * Encodes a string to base64 using UTF-8 encoding
 * @param {string} str - The string to encode
 * @returns {string} Base64 encoded string
 */
export function encodeSource(str) {
  const encoder = new TextEncoder();
  return btoa(String.fromCharCode(...encoder.encode(str)));
}

/**
 * Decodes a base64 string back to UTF-8
 * @param {string} base64 - The base64 string to decode
 * @returns {string} Decoded string
 */
export function decodeSource(base64) {
  const decoder = new TextDecoder();
  return decoder.decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
}

/**
 * Logs debug messages with a consistent prefix
 * @param {...any} args - Arguments to log
 */
export function debug(...args) {
  console.log("[TypstAddin]", ...args);
}

/**
 * Computes the size of an SVG from its viewBox attribute
 * @param {string} svg - SVG content as string
 * @param {number} scale - Scale factor to apply
 * @param {number} fallbackWidth - Width to use if viewBox not found
 * @returns {{width: number, height: number}} Computed dimensions
 */
export function computeSizeFromSvg(svg, scale = 1.0, fallbackWidth = 300) {
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
 * Calculates the actual bounding box of SVG content including padding
 * @param {SVGElement} svgElement - The SVG element to measure
 * @returns {{x: number, y: number, width: number, height: number}|null} Bounding box or null
 */
function calculateActualBounds(svgElement) {
  try {
    const bbox = svgElement.getBBox();
    const padding = Math.max(bbox.width, bbox.height) * 0.1;

    return {
      x: bbox.x - padding,
      y: bbox.y - padding,
      width: bbox.width + 2 * padding,
      height: bbox.height + 2 * padding,
    };
  } catch {
    return null;
  }
}

/**
 * Applies explicit width and height attributes to an SVG element
 * @param {string} svg - SVG content as string
 * @param {number|null} targetHeight - Desired height, or null to use natural size
 * @returns {{svg: string, size: {width: number, height: number}}} Modified SVG and computed size
 */
export function applySizeToSvg(svg, targetHeight) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const svgElement = doc.documentElement;

    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.visibility = "hidden";
    tempContainer.style.width = "0";
    tempContainer.style.height = "0";
    document.body.appendChild(tempContainer);
    tempContainer.appendChild(svgElement);

    const actualBounds = calculateActualBounds(svgElement);

    document.body.removeChild(tempContainer);

    if (actualBounds && actualBounds.width > 0 && actualBounds.height > 0) {
      svgElement.setAttribute("viewBox",
        `${actualBounds.x} ${actualBounds.y} ${actualBounds.width} ${actualBounds.height}`,
      );

      const aspectRatio = actualBounds.width / actualBounds.height;
      const height = targetHeight || actualBounds.height;
      const width = height * aspectRatio;

      svgElement.setAttribute("height", `${height}`);
      svgElement.setAttribute("width", `${width}`);

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
    const height = targetHeight || parts[3];
    const width = height * aspectRatio;

    svgElement.setAttribute("height", `${height}`);
    svgElement.setAttribute("width", `${width}`);

    const serializer = new XMLSerializer();
    const modifiedSvg = serializer.serializeToString(svgElement);

    return { svg: modifiedSvg, size: { width, height } };
  } catch (error) {
    debug("applySizeToSvg failed", error);
    return { svg, size: computeSizeFromSvg(svg) };
  }
}
