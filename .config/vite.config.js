import { defineConfig } from "vite";
import fs from "fs";

export default defineConfig(({ command }) => ({
  root: "web",
  build: {
    outDir: "../build/",
    emptyOutDir: true,
  },
  server: {
    port: 3155,
    ...(command === "serve" && {
      https: {
        key: fs.readFileSync("web/certs/localhost.key"),
        cert: fs.readFileSync("web/certs/localhost.crt"),
      },
    }),
  },
}));
