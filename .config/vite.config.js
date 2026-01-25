import { defineConfig } from "vite";
import fs from "fs";

const input = {
  main: "web/index.html",
  privacy: "web/privacy.html",
  powerpoint: "web/powerpoint.html",
};

export default defineConfig(({ command }) => ({
  root: "web",
  base: "/typst-powerpoint/",
  build: {
    outDir: "../build/",
    emptyOutDir: true,
    rollupOptions: {
      input,
    },
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
