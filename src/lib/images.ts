/**
 * Shrinks a picture before upload (max 512px, WebP, transparency kept).
 * SVG and GIF are uploaded as they are.
 */
export async function prepareImage(file: File, max = 512): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    if (file.size > 2 * 1024 * 1024) throw new Error('Image is larger than 2 MB.')
    return file
  }
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.9))
  if (!blob) throw new Error('Could not process this image.')
  return blob
}
