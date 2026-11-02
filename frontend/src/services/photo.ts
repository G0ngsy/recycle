export async function preparePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('JPEG 또는 PNG 사진을 선택해주세요. HEIC·GIF 등은 JPEG로 변환해주세요.');
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('사진은 20MB 이하로 선택해주세요.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('사진을 읽지 못했습니다. 손상되지 않은 JPEG 또는 PNG 사진을 선택해주세요.');
  }
  try {
    if (bitmap.width * bitmap.height > 40_000_000) {
      throw new Error('사진 해상도가 너무 큽니다. 크기를 줄여 다시 선택해주세요.');
    }
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('사진을 처리할 수 없습니다.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    bitmap.close();
  }
}
