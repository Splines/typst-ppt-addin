import { state, setWasmReady } from "./state.js";
import { debug } from "./utils.js";
import { setStatus } from "./ui.js";

let compileTypstWasm = null;
let initFontsWasm = null;
let initWasm = null;

/**
 * Initializes the WASM module references
 * @param {Function} init - WASM initialization function
 * @param {Function} compile_typst - WASM compile function
 * @param {Function} init_fonts - WASM font initialization function
 */
export function setWasmFunctions(init, compile_typst, init_fonts) {
  initWasm = init;
  compileTypstWasm = compile_typst;
  initFontsWasm = init_fonts;
}

/**
 * Loads compiler configuration from config.json or environment
 * @returns {Promise<{url: string|null, auth: string|null}>} Compiler configuration
 */
export async function loadCompilerConfig() {
  let config = {
    url: window.TYPST_COMPILER_URL || null,
    auth: window.TYPST_COMPILER_AUTH || null,
  };

  try {
    const response = await fetch("./config.json", { cache: "no-store" });
    if (response.ok) {
      const json = await response.json();
      config.url = json.compilerUrl || config.url;
      config.auth = json.compilerAuth || config.auth;
    }
  } catch {
    debug("Config file not found, using defaults");
  }

  return config;
}

/**
 * Sets up the WASM compiler module
 * @returns {Promise<boolean>} True if successful
 */
export async function setupWasm() {
  if (!initWasm || !compileTypstWasm || !initFontsWasm) {
    debug("WASM functions not set");
    return false;
  }

  try {
    await initWasm();

    const fontResponse = await fetch("./assets/math-font.ttf");
    const fontBuffer = await fontResponse.arrayBuffer();
    initFontsWasm(new Uint8Array(fontBuffer));

    setWasmReady(true);
    debug("WASM initialized");
    return true;
  } catch (error) {
    console.error("WASM Load Error:", error);
    return false;
  }
}

/**
 * Compiles Typst source code using the remote compiler service
 * @param {string} source - Typst source code
 * @returns {Promise<string>} SVG output or error message
 */
export async function compileRemote(source) {
  if (!state.compilerConfig.url) {
    return null;
  }

  setStatus("Compiling via remote service...");
  debug("Remote compile request to", state.compilerConfig.url);

  try {
    const headers = { "Content-Type": "application/json" };
    if (state.compilerConfig.auth) {
      headers["Authorization"] = `Bearer ${state.compilerConfig.auth}`;
    }

    const response = await fetch(state.compilerConfig.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ source, format: "svg" }),
    });

    if (!response.ok) {
      debug("Remote compile HTTP error", response.status, response.statusText);
      throw new Error(`Remote compile failed (${response.status})`);
    }

    const data = await response.json();

    if (data.error) {
      debug("Remote compile returned error", data.error);
      throw new Error(data.error);
    }

    if (!data.svg) {
      debug("Remote compile missing svg field", data);
      throw new Error("Remote compile did not return SVG");
    }

    debug("Remote compile success; svg length", data.svg.length);
    return data.svg;
  } catch (error) {
    console.error("Remote compile error:", error);
    setStatus(`Remote compile failed: ${error.message}`, true);
    return `Error: ${error.message}`;
  }
}

/**
 * Compiles Typst source code using the local WASM compiler
 * @param {string} source - Typst source code
 * @returns {string} SVG output or error message
 */
export function compileWasm(source) {
  if (!state.isWasmReady || !compileTypstWasm) {
    return "Error: WASM not ready";
  }

  try {
    return compileTypstWasm(source);
  } catch (error) {
    console.error("Compile Error:", error);
    return `Error: ${error.message}`;
  }
}

/**
 * Compiles Typst source code using the appropriate compiler (remote or WASM)
 * @param {string} source - Typst source code
 * @returns {Promise<string>} SVG output or error message
 */
export async function compile(source) {
  if (state.compilerConfig.url) {
    return await compileRemote(source);
  }
  return compileWasm(source);
}
