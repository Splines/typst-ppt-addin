/**
 * Typst.ts integration for compiling and rendering Typst code to SVG.
 *
 * This makes use of the typst.ts library by Myriad Dreamin:
 * https://myriad-dreamin.github.io/typst.ts/
 */

import type * as typstWeb from "@myriaddreamin/typst.ts";
import { createTypstCompiler, createTypstRenderer } from "@myriaddreamin/typst.ts";
import { disableDefaultFontAssets, loadFonts } from "@myriaddreamin/typst.ts/dist/esm/options.init.mjs";

// @ts-expect-error WASM module import
import typstCompilerWasm from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
// @ts-expect-error WASM module import
import typstRendererWasm from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";

let compiler: typstWeb.TypstCompiler;
let renderer: typstWeb.TypstRenderer;

/**
 * Initializes both the Typst compiler and renderer.
 */
export async function initTypst() {
  await initCompiler();
  await initRenderer();
}

/**
 * Initializes the Typst compiler.
 *
 * See also https://myriad-dreamin.github.io/typst.ts/cookery/guide/all-in-one.html#label-Initializing%20using%20the%20low-level%20API
 */
async function initCompiler() {
  compiler = createTypstCompiler();
  await compiler.init({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    getModule: () => typstCompilerWasm,
    beforeBuild: [
      disableDefaultFontAssets(),
      loadFonts([
        "assets/math-font.ttf",
      ]),
    ],
  });
  console.log("Typst compiler initialized");
}

/**
 * Initializes the Typst renderer.
 *
 * See also https://myriad-dreamin.github.io/typst.ts/cookery/guide/all-in-one.html#label-Initializing%20using%20the%20low-level%20API
 */
async function initRenderer() {
  renderer = createTypstRenderer();
  await renderer.init({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    getModule: () => typstRendererWasm,
  });
  console.log("Typst renderer initialized");
}

/**
 * Builds the complete Typst code with page setup and font size.
 *
 * Note: If you change the number of lines added here, make sure to update
 * the diagnostic range offset in preview.ts accordingly.
 *
 * @param rawCode - The user's Typst code
 * @param fontSize - Font size in points
 * @returns Complete Typst code ready for compilation
 */
function buildRawTypstString(rawCode: string, fontSize: string): string {
  return "#set page(margin: 3pt, background: none, width: auto, fill: none, height: auto)"
    + `\n#set text(size: ${fontSize}pt)\n${rawCode}`;
}

export interface CompilationResult {
  svg: string | null;
  diagnostics: Diagnostics;
}

/**
 * Diagnostic message structure returned by the Typst compiler.
 *
 * See https://github.com/Myriad-Dreamin/typst.ts/blob/3fe6e3caefaab9947689f162c8ea8b193944eef3/packages/typst.ts/src/compiler.mts#L24-L43
 * Unfortunately the interface is not exported directly from the package,
 * so we redefine it here.
 */
export interface DiagnosticMessage {
  package: string;
  path: string;
  severity: string;
  range: string;
  message: string;
}

export type Diagnostics = (string | DiagnosticMessage)[] | undefined;

/**
 * Compiles the given Typst source to SVG.
 */
export async function typst(source: string, fontSize: string): Promise<CompilationResult> {
  const mainFilePath = "/main.typ";
  const typstCode = buildRawTypstString(source, fontSize);
  compiler.addSource(mainFilePath, typstCode);
  const response = await compiler.compile({ mainFilePath });
  const diagnostics: Diagnostics = response.diagnostics;

  if (diagnostics && diagnostics.length > 0) {
    console.warn("Typst compilation diagnostics:", diagnostics);
    return { svg: null, diagnostics };
  }

  const artifactContent = response["result"] as Uint8Array<ArrayBuffer>;
  const svg = await renderer.renderSvg({
    format: "vector",
    artifactContent: artifactContent,
    data_selection: {
      body: true,
      defs: true,
      css: true,
      js: false,
    },
  });

  return { svg, diagnostics };
}
