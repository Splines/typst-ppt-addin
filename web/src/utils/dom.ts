/**
 * Type-safe DOM access helpers.
 */

/**
 * Gets an HTMLElement by ID with type safety
 * @throws Error if element is not found
 */
function getElement<T extends HTMLElement>(
  id: string,
  elementType: new () => T,
): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element with id '${id}' not found`);
  }
  if (!(element instanceof elementType)) {
    throw new Error(
      `Element with id '${id}' is not of type ${elementType.name}, but ${element.constructor.name}`,
    );
  }
  return element;
}

/**
 * Gets an HTMLAreaElement by ID.
 */
export function getAreaElement(id: string): HTMLTextAreaElement {
  return getElement(id, HTMLTextAreaElement);
}

/**
 * Gets an HTMLInputElement by ID.
 */
export function getInputElement(id: string): HTMLInputElement {
  return getElement(id, HTMLInputElement);
}

/**
 * Gets a generic HTMLElement by ID.
 */
export function getHTMLElement(id: string): HTMLElement {
  return getElement(id, HTMLElement);
}
