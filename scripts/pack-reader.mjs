// Packs ProjectFM's save reader (savereader/, our own copy of the code that reads FM saves,
// started from fmsave 0.12.6, MIT) into one tar file the save import unpacks in the browser.
// Runs before dev and build; the tar is not committed.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = 'savereader'
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name !== '__pycache__') walk(path)
    } else if (!name.endsWith('.pyc')) files.push(path)
  }
}
walk(root)

/** One ustar header block for a regular file. */
function header(name, size) {
  const b = Buffer.alloc(512)
  const put = (s, at, len) => b.write(s, at, len, 'utf8')
  const oct = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0'
  put(name, 0, 100)
  put(oct(0o644, 8), 100, 8)
  put(oct(0, 8), 108, 8)
  put(oct(0, 8), 116, 8)
  put(oct(size, 12), 124, 12)
  put(oct(0, 12), 136, 12)
  b.fill(' ', 148, 156)
  put('0', 156, 1)
  put('ustar\0', 257, 6)
  put('00', 263, 2)
  let sum = 0
  for (const x of b) sum += x
  put(oct(sum, 7) + ' ', 148, 8)
  return b
}

const parts = []
for (const f of files) {
  const name = relative(root, f).split('\\').join('/')
  if (Buffer.byteLength(name) > 99) throw new Error(`Path too long for tar: ${name}`)
  const data = readFileSync(f)
  parts.push(header(name, data.length), data, Buffer.alloc((512 - (data.length % 512)) % 512))
}
parts.push(Buffer.alloc(1024))
mkdirSync('public/fmsave', { recursive: true })
writeFileSync('public/fmsave/savereader.tar', Buffer.concat(parts))
console.log(`Save reader: packed ${files.length} files into public/fmsave/savereader.tar`)
