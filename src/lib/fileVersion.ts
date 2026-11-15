import { useQueryClient } from '@tanstack/react-query'
import { saveConfig } from '../data/config'
import { unzstd } from '../import/readSave'
import { readFmfMember, type Unzstd } from '../tactics/fmfRead'
import { useConfig } from './config'

const hexOf = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')

/** The game version an FM file was written by (hex, as in Settings > FM codes), if found. */
export async function fileVersionOf(file: Uint8Array, unzip: Unzstd): Promise<string | null> {
  try {
    const details = hexOf(await readFmfMember(file, '.aom', unzip))
    // …author name, 02 00 01 00 02, the version (4 bytes), 01 00 10, the file's id
    const m = /0200010002([0-9a-f]{8})010010[0-9a-f]{20}$/.exec(details)
    return m ? m[1] : null
  } catch {
    return null
  }
}

/**
 * Checks every FM file the user uploads: when FM writes another version (a game patch),
 * Settings > FM codes follows it so exports keep loading in FM. Returns a note when it changed.
 */
export function useLearnFileVersion() {
  const config = useConfig()
  const qc = useQueryClient()
  return async (file: Uint8Array): Promise<string | null> => {
    const version = await fileVersionOf(file, unzstd)
    if (!version || version === config.fmCodes.fileVersion) return null
    await saveConfig('fmCodes', { ...config.fmCodes, fileVersion: version })
    await qc.invalidateQueries({ queryKey: ['settings'] })
    return `This file comes from a newer FM version (${version}, was ${config.fmCodes.fileVersion}). Exports now use it; see Settings > FM codes.`
  }
}
