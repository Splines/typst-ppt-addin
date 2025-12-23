// Simple HTTPS static server for local add-in development.
// Prereq: place your cert/key in ./certs/localhost.crt and ./certs/localhost.key
// Run: node dev-server.js

const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = process.env.ROOT || __dirname;
const CERT_PATH = process.env.CERT || path.join(__dirname, "certs", "localhost.crt");
const KEY_PATH = process.env.KEY || path.join(__dirname, "certs", "localhost.key");

function loadTls() {
  return {
    cert: fs.readFileSync(CERT_PATH),
    key: fs.readFileSync(KEY_PATH),
  };
}

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html";
    case ".js":
      return "application/javascript";
    case ".css":
      return "text/css";
    case ".json":
      return "application/json";
    case ".svg":
      return "image/svg+xml";
    case ".ttf":
      return "font/ttf";
    case ".wasm":
      return "application/wasm";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": getMime(filePath) });
    res.end(data);
  });
}

const server = https.createServer(loadTls(), (req, res) => {
  const urlPath = req.url.split("?")[0];
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(ROOT, safePath);

  // Default to index.html for root or directory requests.
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath) && urlPath === "/") {
    filePath = path.join(ROOT, "index.html");
  }

   // Serve an empty favicon to avoid 404 noise.
  if (urlPath === "/favicon.ico") {
    res.writeHead(200, { "Content-Type": "image/x-icon" });
    res.end();
    return;
  }

  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`HTTPS dev server running at https://localhost:${PORT}`);
});
