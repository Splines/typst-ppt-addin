# Typst PowerPoint Add-in: Local Dev Steps

Follow these steps to build the Typst engine, host the add-in over HTTPS, and sideload it into PowerPoint.

## Prereqs
- Node.js installed (for the dev server).
- `wasm-pack` installed (builds the Typst engine to WebAssembly).
- A locally trusted HTTPS cert for `localhost`.

## 1) Build the Typst WASM bundle
Replace the stubbed `pkg/typst_ppt_engine.js` with the real wasm-bindgen output:
```bash
wasm-pack build --target web
```
- Output should include `pkg/typst_ppt_engine.js` and the matching `.wasm` file.
- Keep both files in `pkg/` so `script.js` can import them.

## 2) Create and trust a dev certificate
You need an HTTPS cert PowerPoint will accept for `localhost`.
- With mkcert (recommended):
  ```bash
  mkcert -install
  mkcert -cert-file certs/localhost.crt -key-file certs/localhost.key localhost
  ```
- With OpenSSL (fallback):
  ```bash
  mkdir -p certs
  openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/localhost.key -out certs/localhost.crt -days 365 -subj "/CN=localhost"
  ```
Then trust the generated `localhost.crt` in your OS keychain/cert store so Office accepts it.

## 3) Start the HTTPS dev server
From the repo root:
```bash
npm run dev
```
- Default: `https://localhost:3000` serving the repo root.
- Env overrides: `PORT=3443`, `ROOT=/path/to/dir`, `CERT=/path/to/cert.crt`, `KEY=/path/to/cert.key`.

## 4) Verify manifest matches the server
`manifest.xml` currently points to `https://localhost:3000/index.html`. If you change the host/port, update `SourceLocation` accordingly.

## 5) Sideload into PowerPoint
1. Open PowerPoint → File → Options → Trust Center → Trust Center Settings → Trusted Add-in Catalogs.
2. Add a Shared Folder catalog pointing to this folder (where `manifest.xml` lives) and check “Show in Menu”.
3. Restart PowerPoint, then Insert → My Add-ins → Shared Folder → select the Typst add-in.

## 6) Manual test flow
- Open the taskpane; wait for “Insert / Update” (WASM ready).
- Enter Typst (e.g., `$a^2+b^2=c^2$`) → Insert: should place an SVG with alt-text starting `TYPST:`.
- Select that shape: the Typst source should repopulate the textbox.
- Edit the code and click Insert/Update: should replace in place (same position).
- Try malformed Typst: you should get a friendly error and no shape insertion.

## Notes
- Keep `assets/math-font.ttf` reachable at `/assets/math-font.ttf` on the same HTTPS origin.
- If insertion silently fails, check the taskpane console for “Insert failed” or “WASM Load Error”.
