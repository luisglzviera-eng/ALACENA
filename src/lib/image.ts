/** Convierte la foto (base64) en un JPG liviano para guardarla. Si el navegador no puede reducirla, usa la original. */
export async function b64ToJpegBlob(b64: string, mime = 'image/jpeg', maxWidth = 900): Promise<Blob> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const original = new Blob([bytes], { type: mime });
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return original;
    const bitmap = await createImageBitmap(original);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const shrunk = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    return shrunk && shrunk.size < original.size ? shrunk : original;
  } catch {
    return original;
  }
}
