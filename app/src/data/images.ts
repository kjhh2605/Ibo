import type {DescribeImage} from './queue';

/** Decode and re-encode selected storefront/cutout only; never forwards metadata or original bytes. */
export async function describeImage(bytes: Uint8Array): Promise<DescribeImage> {
  const blob = new Blob([new Uint8Array(bytes)]);
  const bitmap = await createImageBitmap(blob, {imageOrientation: 'from-image'});
  try {
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    for (;;) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw {code: 'image_unavailable', retryable: false};
      context.drawImage(bitmap, 0, 0, width, height);
      const encoded = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject({code: 'image_unavailable', retryable: false}), 'image/png'));
      if (encoded.size <= 4 * 1024 * 1024) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject({code: 'io_error', retryable: true});
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.readAsDataURL(encoded);
        });
        return {data, width, height, mimeType: 'image/png'};
      }
      if (width === 1 && height === 1) throw {code: 'image_too_large', retryable: false};
      width = Math.max(1, Math.floor(width * 0.8));
      height = Math.max(1, Math.floor(height * 0.8));
    }
  } finally { bitmap.close(); }
}
