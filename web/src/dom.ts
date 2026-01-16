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
      `Element with id '${id}' is not of type ${elementType.name}`,
    );
  }
  return element;
}

/**
 * Gets an HTMLInputElement by ID.
 */
export function getInputElement(id: string): HTMLInputElement {
  return getElement(id, HTMLInputElement);
}

/**
 * Gets an HTMLButtonElement by ID.
 */
export function getButtonElement(id: string): HTMLButtonElement {
  return getElement(id, HTMLButtonElement);
}

/**
 * Gets a generic HTMLElement by ID.
 */
export function getHTMLElement(id: string): HTMLElement {
  return getElement(id, HTMLElement);
}

/**
 * DOM element cache for performance.
 */
export class DOMCache {
  private cache = new Map<string, HTMLElement>();

  /**
   * Gets an element from cache or DOM.
   */
  get<T extends HTMLElement>(id: string, elementType: new () => T): T {
    const cached = this.cache.get(id);
    if (cached && cached instanceof elementType) {
      return cached;
    }

    const element = getElement(id, elementType);
    this.cache.set(id, element);
    return element;
  }

  /**
   * Clears the cache.
   */
  clear() {
    this.cache.clear();
  }
}

/**
 * Validates that all required DOM elements exist.
 * @throws Error if any element is missing
 */
export function validateDOMElements(ids: string[]): void {
  const missing: string[] = [];
  for (const id of ids) {
    if (!document.getElementById(id)) {
      missing.push(id);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Required DOM elements not found: ${missing.join(", ")}`,
    );
  }
}
