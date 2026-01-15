import { createTypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import typstCompilerWasm from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";

let compiler;

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
 * Compiles the given Typst source to SVG in the browser without a server by
 * using typst.ts by Myriad Dreamin.
 *
 * https://myriad-dreamin.github.io/typst.ts/cookery/guide/compiler/bindings.html
 */
export async function compile(source) {
  const mainFilePath = "/main.typ";
  compiler.addSource(mainFilePath, source);
  const response = await compiler.compile({ mainFilePath, format: "svg" });

  if (!Object.prototype.hasOwnProperty.call(response, "result")) {
    throw new Error("Compilation failed: no result");
  }

  const data = response["result"]; // Uint8Array
  return new TextDecoder().decode(data);
}
