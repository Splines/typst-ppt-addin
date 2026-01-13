// Minimal Typst compiler service for the add-in.
// POST /compile with JSON { source: string, format?: "svg" }.
// Requires typst CLI installed (https://typst.app/docs/reference/cli/).

const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = Number(process.env.COMPILER_PORT || 4000);
const HOST = process.env.COMPILER_HOST || "0.0.0.0";
const TYPST_BIN = process.env.TYPST_BIN || "typst";
const MAX_BODY = Number(process.env.MAX_BODY_BYTES || 1_000_000); // ~1MB
const VERBOSE = process.env.VERBOSE === "1" || process.env.VERBOSE === "true";

function send(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function badRequest(res, msg) {
  send(res, 400, { error: msg });
}

function internal(res, msg) {
  send(res, 500, { error: msg });
}

function runTypstCompile(source, format, cb) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "typst-"));
  const cleanup = () => fs.rm(dir, { recursive: true, force: true }, () => {});
  const inputName = "main.typ";
  const outputName = `out.${format}`;
  const inputPath = path.join(dir, inputName);
  const outputPath = path.join(dir, outputName);
  fs.writeFileSync(inputPath, source, "utf8");
  if (VERBOSE) {
    console.log(`[compiler] Temp dir: ${dir}`);
    console.log(`[compiler] input exists: ${fs.existsSync(inputPath)}`);
  }
  // Use relative paths with cwd to avoid Windows path oddities
  const args = ["compile", inputName, outputName];
  const child = spawn(TYPST_BIN, args, { cwd: dir });
  let stderr = "";
  let stdout = "";
  child.stdout.on("data", (d) => {
    const t = d.toString();
    stdout += t;
    if (VERBOSE) console.log(`[compiler stdout] ${t.trimEnd()}`);
  });
  child.stderr.on("data", d => (stderr += d.toString()));

  child.on("error", (err) => {
    cleanup();
    cb(err, null, stderr);
  });
  child.on("exit", (code) => {
    if (code !== 0) {
      if (VERBOSE) {
        console.log(`[compiler] typst exited with code ${code}`);
        if (stdout) console.log(`[compiler] stdout:\n${stdout}`);
        if (stderr) console.log(`[compiler] stderr:\n${stderr}`);
      }
      cleanup();
      cb(new Error(`typst exited with code ${code}`), null, stderr);
      return;
    }
    try {
      const svg = fs.readFileSync(outputPath, "utf8");
      cleanup();
      cb(null, svg, stderr);
    } catch (e) {
      cleanup();
      cb(e, null, stderr);
    }
  });
}

function handleCompile(req, res, body) {
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    if (VERBOSE) console.log("[compiler] Invalid JSON");
    return badRequest(res, "Invalid JSON");
  }
  const source = payload?.source;
  const format = (payload?.format || "svg").toLowerCase();
  if (!source || typeof source !== "string") {
    if (VERBOSE) console.log("[compiler] Missing/invalid source");
    return badRequest(res, "`source` must be a string");
  }
  if (format !== "svg") {
    if (VERBOSE) console.log("[compiler] Unsupported format", format);
    return badRequest(res, "Only svg format is supported");
  }
  if (VERBOSE) {
    const preview = source.slice(0, 200).replace(/\s+/g, " ");
    console.log(`[compiler] Compile request: format=${format} len=${source.length} preview="${preview}"`);
  }
  runTypstCompile(source, format, (err, svg, stderr) => {
    if (err) {
      if (VERBOSE) console.log("[compiler] Error:", err.message);
      return internal(res, `${err.message}${stderr ? `: ${stderr}` : ""}`);
    }
    if (VERBOSE) console.log("[compiler] Success, svg length", svg.length);
    send(res, 200, { svg });
  });
}

const server = http.createServer((req, res) => {
  // Simple CORS for local use
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/compile") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) {
        if (VERBOSE) console.log("[compiler] Body too large, closing");
        res.writeHead(413);
        res.end();
        req.destroy();
      }
    });
    req.on("end", () => handleCompile(req, res, body));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`Typst compiler service listening on http://${HOST}:${PORT}/compile`);
  if (VERBOSE) {
    console.log(`- TYPST_BIN=${TYPST_BIN}`);
    console.log(`- MAX_BODY_BYTES=${MAX_BODY}`);
  }
});
