// Copies the Pyodide runtime (Python in the browser, MPL-2.0) next to the app so the save
// import works without a CDN. Runs before dev and build; the copy is not committed.
import { cpSync, mkdirSync } from 'node:fs'

const files = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
]
mkdirSync('public/pyodide', { recursive: true })
for (const f of files) cpSync(`node_modules/pyodide/${f}`, `public/pyodide/${f}`)
console.log(`Pyodide: copied ${files.length} files to public/pyodide`)
