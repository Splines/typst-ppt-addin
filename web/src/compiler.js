import { createTypstCompiler, createTypstRenderer } from "@myriaddreamin/typst.ts";
import typstCompilerWasm from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import typstRendererWasm from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";

let compiler;
let renderer;
/**
 * Initializes the Typst compiler.
 */
export async function initCompiler() {
  compiler = createTypstCompiler();
  await compiler.init({
    getModule: () => {
      // https://myriad-dreamin.github.io/typst.ts/cookery/guide/all-in-one.html#label-Initializing%20using%20the%20low-level%20API
      // https://vite.dev/guide/features.html#webassembly
      return typstCompilerWasm;

      // alternative: load from CDN
      // return "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm";
    },
  });
  console.log("Typst compiler initialized");
}

/**
 * Initializes the Typst renderer.
 */
export async function initRenderer() {
  renderer = createTypstRenderer();
  await renderer.init({
    getModule: () => {
      return typstRendererWasm;
    },
  });
  console.log("Typst renderer initialized");
}

/**
 * Compiles the given Typst source to SVG in the browser without a server by
 * using typst.ts by Myriad Dreamin.
 *
 * https://myriad-dreamin.github.io/typst.ts/cookery/guide/compiler/bindings.html
 */
export async function compile(source) {
  const mainFilePath = "/main.typ";
  compiler.addSource(mainFilePath, source);
  const response = await compiler.compile({ mainFilePath });

  if (!Object.prototype.hasOwnProperty.call(response, "result")) {
    throw new Error("Compilation failed: no result");
  }

  // https://myriad-dreamin.github.io/typst.ts/cookery/guide/renderer/ts-lib.html#label-Example:%20render%20a%20precompiled%20document%20inside%20of%20some%20%3Cdiv/%3E%20element
  const artifactContent = new Uint8Array(response["result"]);
  console.log(artifactContent);

  const svg = await renderer.renderSvg({
    format: "vector",
    artifactContent: artifactContent,
  });

  return svg;
}
