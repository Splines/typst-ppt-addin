> [!Important]
> This is the old Readme that will become the new developer guide. It is currently outdated.

# PoC: Typst PowerPoint Add-in

Note: this project is merely a proof of concept and by no means production-ready. It was built (50% vibe-coded) on two evenings for fun and learning.

A PowerPoint taskpane add-in that renders Typst snippets to SVG via a Rust/WebAssembly engine and inserts them into slides. Each inserted shape carries the original Typst source in its alt text so you can reselect and update it later without losing positioning.

![Screenshot of Typst PowerPoint Add-in](demo.png)

## How it works
- `engine/`: Rust crate compiled to WebAssembly with `wasm-bindgen`, wrapping Typst to produce SVG. A bundled math font is initialized at runtime.
- `web/`: Taskpane UI (`index.html` + `script.js`), manifest, and a simple HTTPS static server for local development. `script.js` compiles Typst, inserts/replaces shapes, and round-trips the Typst source from a shape's `altTextDescription`.
- Remote compiler mode: set `COMPILER_URL` to offload compilation to an HTTP endpoint (e.g., the included `compiler-server.js`), which returns SVG so the add-in can skip local WebAssembly compilation. This is required if you require packages that the WASM build doesn't include.
![Remote compiler enables use of any Typst package](packages.png)

## Prerequisites
- PowerPoint
- Node.js
- `wasm-pack` installed (`cargo install wasm-pack`).
- A locally trusted HTTPS certificate for `localhost` (paths default to `web/certs/localhost.{crt,key}`).

## Setup
1) Install JS tooling (run once):
```bash
npm install
```
2) Build the Typst WASM bundle (outputs to `web/pkg/`):
```bash
npm run build:engine
```
3) Create and trust a `localhost` certificate (mkcert recommended):
```bash
mkcert -install
mkcert -cert-file web/certs/localhost.crt -key-file web/certs/localhost.key localhost
# or with OpenSSL:
# openssl req -x509 -newkey rsa:2048 -nodes -keyout web/certs/localhost.key -out web/certs/localhost.crt -days 365 -subj "/CN=localhost"
```
4) Start the HTTPS dev server (defaults to `https://localhost:3000`):
```bash
npm run dev
# optional env:
#   PORT=3443 ROOT=/abs/path CERT=/path/to.crt KEY=/path/to.key
#   COMPILER_URL=https://your-compiler-endpoint/compile   # POST { source, format: "svg" }
#   COMPILER_AUTH=token-for-bearer-auth                    # sent as Authorization: Bearer <token>
# The taskpane reads /config.json from the dev server; when COMPILER_URL is set, it uses the remote compiler instead of local WASM.
```
5) Point the manifest at your server if you change host/port (`web/manifest.xml` → `SourceLocation`).

### Run the (optional) compiler service
This service shells out to the Typst CLI so packages auto-download and compile:
```bash
# install typst CLI first, e.g.: cargo install typst-cli
npm run compiler
# env: COMPILER_PORT=4000 COMPILER_HOST=0.0.0.0 TYPST_BIN=typst MAX_BODY_BYTES=1000000
```
Then set `COMPILER_URL=http://localhost:4000/compile` before `npm run dev` so the add-in posts to it. You can also host this service remotely and point `COMPILER_URL` and optional `COMPILER_AUTH` at that endpoint to offload compilation without rebuilding the add-in.

## Sideload into PowerPoint
1. PowerPoint → File → Options → Trust Center → Trust Center Settings → Trusted Add-in Catalogs.  
2. Add a Shared Folder catalog pointing to this repo (where `web/manifest.xml` lives) and check "Show in Menu." (this requires the folder to be shared as a network folder so that the Catalog URL will be something like `\\your-device\path\to\repo\web`. On Windows, you can share a folder by right-clicking it in File Explorer, selecting "Properties," going to the "Sharing" tab, and clicking "Advanced Sharing..." and "Share this folder". Follow the prompts to share the folder on your network.)
3. Restart PowerPoint → Home → Add-ins → Advanced → pick the Typst add-in.  
4. Open the taskpane; wait for "Insert / Update" once WASM loads.

## Usage
- Enter Typst code (e.g. `$a^2 + b^2 = c^2$`) and click **Insert / Update** to place an SVG on the current slide.
- Select an existing Typst-generated shape to automatically reload its source into the textbox, edit, and re-run Insert / Update to replace it in place (position preserved).
- Shapes are tagged with `altTextDescription` starting `TYPST:` plus the encoded source; math font is served from `web/assets/math-font.ttf` on the same origin.
- Remote compiler: if `COMPILER_URL` is set, the add-in POSTs `{ source, format: "svg" }` (with optional bearer auth) to that endpoint and uses the returned `svg`. Local WASM is used only when `COMPILER_URL` is not configured.

## NPM scripts
- `npm run build:engine` — Build the Rust engine to WebAssembly into `web/pkg/`.
- `npm run dev` — HTTPS static server for local development (`web/dev-server.js`).
- `npm start` — Launch the Office add-in debugger with `web/manifest.xml`.
- `npm run stop` — Stop the Office add-in debugger.

## Tips
- If insertion silently fails, check the taskpane console for "Insert failed" or "WASM Load Error."
- Ensure the built `pkg/typst_ppt_engine.js` and `.wasm` file stay in `web/pkg/`.
- Keep the math font available at `/assets/math-font.ttf`.
