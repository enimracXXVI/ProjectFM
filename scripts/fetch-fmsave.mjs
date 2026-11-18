// Downloads the newest fmsave (the save reader, MIT) from PyPI before dev and build, so the
// app always reads saves with the latest release. The import falls back to the committed
// known-good copy (public/fmsave/fmsave-known-good.whl) if the newest one fails on a save.
// Offline: the known-good copy is used as the newest too.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'

const dir = 'public/fmsave'
const fallback = JSON.parse(readFileSync(`${dir}/fmsave-known-good.json`, 'utf8')).version
try {
  const info = await (await fetch('https://pypi.org/pypi/fmsave/json')).json()
  const version = info.info.version
  const wheel = info.urls.find(
    (u) => u.packagetype === 'bdist_wheel' && u.filename.endsWith('-py3-none-any.whl'),
  )
  if (!wheel) throw new Error(`no pure-Python wheel for fmsave ${version}`)
  const bytes = Buffer.from(await (await fetch(wheel.url)).arrayBuffer())
  writeFileSync(`${dir}/fmsave-latest.whl`, bytes)
  writeFileSync(`${dir}/fmsave-latest.json`, JSON.stringify({ version, fallback }))
  console.log(`fmsave: latest ${version} (known-good ${fallback})`)
} catch (error) {
  copyFileSync(`${dir}/fmsave-known-good.whl`, `${dir}/fmsave-latest.whl`)
  writeFileSync(`${dir}/fmsave-latest.json`, JSON.stringify({ version: fallback, fallback }))
  console.warn(`fmsave: PyPI not reachable (${error.message}); using known-good ${fallback}`)
}
