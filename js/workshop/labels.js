/** Local-only QR labels. Neither images nor decoded contents leave the browser. */
const loading = new Map();
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2048;

function loadLibrary(name, file) {
  if (typeof globalThis[name] === 'function') return Promise.resolve(globalThis[name]);
  if (!loading.has(name)) {
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(`../vendor/${file}`, import.meta.url).href;
      script.async = true;
      script.onload = () => {
        if (typeof globalThis[name] === 'function') resolve(globalThis[name]);
        else reject(new Error('The QR tool could not start. Reload the page and try again.'));
      };
      script.onerror = () => reject(new Error('The local QR tool could not load. You can search by serial number or code.'));
      document.head.append(script);
    }).catch(error => {
      loading.delete(name);
      throw error;
    });
    loading.set(name, promise);
  }
  return loading.get(name);
}

/** Encodes only an instrument short code, never a URL or private record contents. */
export async function qrSVG(code) {
  if (typeof code !== 'string' || !/^[a-z0-9][a-z0-9-]{2,31}$/i.test(code)) {
    throw new Error('The label requires a valid instrument short code.');
  }
  const qrcode = await loadLibrary('qrcode', 'qrcode.js');
  const qr = qrcode(0, 'M');
  qr.addData(code);
  qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: 32, scalable: true })
    .replace('<svg ', `<svg role="img" aria-label="QR code ${code}" `);
}

async function openImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* Fall back for browser-supported formats lacking bitmap support. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('The image could not be opened. Use a clear JPG, PNG or WebP photo of the QR code.');
  }
}

/** Decodes an image file and returns text only; it never opens a decoded link. */
export async function decodeQRFile(file) {
  if (!(file instanceof Blob) || !file.size) throw new Error('Select an image of the QR code.');
  if (file.size > MAX_FILE_BYTES) throw new Error('The photo exceeds 12 MB. Crop it to the QR code and try again.');
  if (file.type && !file.type.startsWith('image/')) throw new Error('Select a JPG, PNG or WebP image.');
  const jsQR = await loadLibrary('jsQR', 'jsQR.js');
  const source = await openImage(file);
  try {
    if (!source.width || !source.height || source.width * source.height > 48_000_000) {
      throw new Error('The image is too large or has invalid dimensions. Crop it to the QR code.');
    }
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser cannot read QR images. Search by serial number or code.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
    // Decoding is deliberately distinct from lookup or navigation.
    if (!result?.data || result.data.length > 4096) throw new Error('No readable QR code was found. Move closer, avoid glare or type the code.');
    return result.data;
  } finally {
    source.close();
  }
}
