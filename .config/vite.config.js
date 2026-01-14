import { defineConfig } from "vite";
import fs from "fs";

export default defineConfig({
  root: "web",
  build: {
    outDir: "../dist/web",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    https: {
      key: fs.readFileSync("web/certs/localhost.key"),
      cert: fs.readFileSync("web/certs/localhost.crt"),
    },
  },
  optimizeDeps: {
    exclude: ["@myriaddreamin/typst-ts-web-compiler"],
  },
});
