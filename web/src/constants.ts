/**
 * Application-wide constants
 */

/**
 * PowerPoint shape configuration.
 */
export const SHAPE_CONFIG = {
  NAME: "Typst Shape",
  TAGS: {
    FONT_SIZE: "TypstFontSize",
    FILL_COLOR: "TypstFillColor",
    MATH_MODE: "TypstMathMode",
  },
} as const;

/**
 * Special values for fill color.
 */
export const FILL_COLOR_DISABLED = "disabled";

/**
 * DOM element IDs used in the UI.
 */
export const DOM_IDS = {
  STATUS: "status",
  FONT_SIZE: "fontSize",
  FILL_COLOR_ENABLED: "fillColorEnabled",
  FILL_COLOR: "fillColor",
  MATH_MODE_ENABLED: "mathModeEnabled",
  INPUT_WRAPPER: "inputWrapper",
  TYPST_INPUT: "typstInput",
  INSERT_BTN: "insertBtn",
  BULK_UPDATE_BTN: "bulkUpdateBtn",
  PREVIEW_CONTENT: "previewContent",
  DARK_MODE_TOGGLE: "darkModeToggle",
  DIAGNOSTICS_CONTAINER: "diagnosticsContainer",
  DIAGNOSTICS_CONTENT: "diagnosticsContent",
} as const;

/**
 * LocalStorage keys.
 */
export const STORAGE_KEYS = {
  FONT_SIZE: "typstFontSize",
  FILL_COLOR: "typstFillColor",
  MATH_MODE: "typstMathMode",
  THEME: "typstTheme",
} as const;

/**
 * SVG processing constants.
 */
export const SVG_CONFIG = {
  PADDING_RATIO: 0.04,
  FALLBACK_WIDTH: 400,
  FALLBACK_HEIGHT: 250,
} as const;

/**
 * Theme values.
 */
export const THEMES = {
  DARK: "dark",
  LIGHT: "light",
} as const;

/**
 * Preview configuration.
 */
export const PREVIEW_CONFIG = {
  MAX_HEIGHT: "150px",
  DARK_MODE_FILL: "#ffffff",
  LIGHT_MODE_FILL: "#000000",
} as const;

/**
 * Button text.
 */
export const BUTTON_TEXT = {
  INSERT: "Insert <kbd>Ctrl+Enter</kbd>",
  UPDATE: "Update <kbd>Ctrl+Enter</kbd>",
} as const;

/**
 * Default values.
 */
export const DEFAULTS = {
  FONT_SIZE: "40",
  FILL_COLOR: "#000000",
} as const;
