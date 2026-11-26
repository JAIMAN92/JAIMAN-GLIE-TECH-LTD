const MAX_RAW_FILE_BYTES = 8 * 1024 * 1024; // 8 MB input guard
const MAX_DIMENSION_PX = 1280;
const MAX_DATA_URL_LENGTH = 1_200_000; // ~900 KB binary

export function isValidQuestionImageUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (/^https?:\/\/\S+/i.test(trimmed)) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  if (
    /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[a-z0-9+/=]+$/i.test(
      trimmed
    )
  ) {
    return trimmed.length <= MAX_DATA_URL_LENGTH;
  }
  return false;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read selected image file.'));
      }
    };
    reader.onerror = () =>
      reject(new Error('Could not read selected image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Selected file could not be decoded as an image.'));
    img.src = src;
  });
}

export async function prepareQuestionImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(
      'Please choose an image file (PNG, JPG, WebP, GIF, or SVG).'
    );
  }

  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new Error('Image file is too large. Maximum file size is 8 MB.');
  }

  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    const rawUrl = await readFileAsDataUrl(file);
    if (rawUrl.length > MAX_DATA_URL_LENGTH) {
      throw new Error(
        'This SVG/GIF diagram is too large. Please use a smaller file under 850 KB.'
      );
    }
    return rawUrl;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const scale = Math.min(
      1,
      MAX_DIMENSION_PX / Math.max(img.naturalWidth || 1, img.naturalHeight || 1)
    );
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return await readFileAsDataUrl(file);
    }

    ctx.drawImage(img, 0, 0, width, height);

    let dataUrl = canvas.toDataURL('image/webp', 0.88);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/png');
    }
    if (dataUrl.length > 750_000) {
      dataUrl = canvas.toDataURL('image/webp', 0.72);
    }
    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    }
    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      throw new Error(
        'Diagram remains too large after compression. Please crop or resize it below 1 MB.'
      );
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
