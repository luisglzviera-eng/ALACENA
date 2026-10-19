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

/** Reduce una foto de ticket (máx. ~1600 px, JPG) para que viaje rápido y no pase el límite de Netlify. Devuelve base64 y el tipo. */
export async function shrinkImageToBase64(file: File, maxSide = 1600): Promise<{ base64: string; mime: string }> {
  const toB64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') throw new Error('sin canvas');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('sin contexto');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('sin blob');
    return { base64: await toB64(blob), mime: 'image/jpeg' };
  } catch {
    return { base64: await toB64(file), mime: ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : 'image/jpeg' };
  }
}
