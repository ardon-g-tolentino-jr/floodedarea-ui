// Client-side image compression for report photos. We store the photo in the DB as base64
// (sent inline in the createReport JSON body), so the browser must shrink it first: a raw phone
// photo is several MB, which would bloat the request and the row. This scales the longest edge
// down and re-encodes as JPEG, stepping quality down until the result fits a size budget.

/** Longest-edge cap and JPEG quality budget. Tuned so a typical phone photo lands well under
 *  ~300 KB of base64 while staying legible as flood evidence. */
const MAX_EDGE = 1280;
const START_QUALITY = 0.7;
const MIN_QUALITY = 0.4;
/** Target for the encoded data-URL length (chars ≈ bytes for base64). ~300 KB. */
const MAX_DATA_URL_CHARS = 300_000;

/** Read a File into an HTMLImageElement (via an object URL, revoked once loaded). */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Please pick a different photo.'));
    };
    img.src = url;
  });
}

/**
 * Compress an image File to a JPEG data-URL (`data:image/jpeg;base64,...`), scaled so its longest
 * edge is ≤ MAX_EDGE and its encoded size is under MAX_DATA_URL_CHARS. Rejects non-image files.
 */
export async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image. Please pick a photo.');
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process that image. Please try again.');
  ctx.drawImage(img, 0, 0, w, h);

  // Step quality down until the encoded data-URL fits the budget (or we hit the floor).
  let quality = START_QUALITY;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > MAX_DATA_URL_CHARS && quality > MIN_QUALITY) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}
