import { defineConfig } from "vite";
import fs from "fs";

export default defineConfig({
  root: "web",
  build: {
    outDir: "../build/",
    emptyOutDir: true,
  },
  server: {
    port: 3155,
    https: {
      key: fs.readFileSync("web/certs/localhost.key"),
      cert: fs.readFileSync("web/certs/localhost.crt"),
    },
  },
});
