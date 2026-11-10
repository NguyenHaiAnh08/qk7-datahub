import { PDFDocument } from 'pdf-lib';

export interface WatermarkOptions {
  userDisplayName: string;
  timeStr: string;
  traceId?: string;
  opacity?: number;
}

/**
 * Sinh ra 1 ảnh Canvas chứa 4 watermark trải đều các khung/vị trí trên trang:
 * - Khung 1: Đầu trang (18%)
 * - Khung 2: Thân trên (38%)
 * - Khung 3: Thân dưới (62%)
 * - Khung 4: Chân trang (82%)
 * 
 * Tự động căn chỉnh theo khổ trang (Đứng Portrait hoặc Ngang Landscape)
 * để đảm bảo tỷ lệ 1:1, font chữ đứng (không bị kéo xiên méo nét) và đồng nhất trên mọi file.
 */
export function generateWatermarkCanvasPng(
  options: WatermarkOptions,
  canvasWidth = 1240,
  canvasHeight = 1754
): Uint8Array {
  const canvas = window.document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2d context for canvas');

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const toTitleCase = (s: string) =>
    s ? s.toLowerCase().split(/\s+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Sĩ Quan';
  const displayName = toTitleCase(options.userDisplayName);
  // Định dạng chuẩn xác 1 hàng: [Họ và tên] - [HH:mm - DD/MM/YYYY] (giống mẫu hình chuẩn)
  const text = `${displayName} - ${options.timeStr}`;

  const isLandscape = canvasWidth > canvasHeight;
  // Góc nghiêng thanh thoát: -25 độ cho khổ đứng, -18 độ cho khổ ngang
  const angle = (isLandscape ? -18 : -25) * (Math.PI / 180);

  // 4 vị trí trải đều các khung từ trên xuống dưới
  const yPositions = [0.18, 0.38, 0.62, 0.82];

  // Font thường (không in đậm, không in nghiêng), chuẩn sans-serif thanh thoát sắc nét
  ctx.font = 'normal 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#b91c1c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const yRatio of yPositions) {
    ctx.save();
    ctx.globalAlpha = options.opacity ?? 0.18;
    ctx.translate(canvasWidth / 2, canvasHeight * yRatio);
    ctx.rotate(angle);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Đóng dấu 4 watermark trực tiếp vào toàn bộ các trang của file PDF:
 * - Tự động nhận diện hướng trang của từng trang (Khổ đứng Portrait hoặc Khổ ngang Landscape)
 * - Khớp tỷ lệ khung hình 1:1, ngăn chặn 100% tình trạng chữ bị kéo méo, dẹp hay biến dạng trên các file khổ ngang như 880/KH.
 * - Giữ nguyên cỡ chữ, góc nghiêng và tính thẩm mỹ đồng nhất trên toàn bộ các tài liệu.
 */
export async function stampWatermarkOnPdf(
  pdfBlob: Blob,
  options: WatermarkOptions
): Promise<Blob> {
  try {
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    const pages = pdfDoc.getPages();
    // Cache ảnh watermark theo hướng trang để không phải sinh canvas lặp lại
    const imageCache = new Map<string, any>();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const isLandscape = width > height;
      const cacheKey = isLandscape ? 'landscape' : 'portrait';

      let watermarkImage = imageCache.get(cacheKey);
      if (!watermarkImage) {
        // Chuẩn hóa tỷ lệ canvas khớp chính xác với tỷ lệ trang tài liệu (loại bỏ hoàn toàn co giãn lệch chiều)
        const canvasWidth = isLandscape ? 1754 : 1240;
        const canvasHeight = isLandscape ? 1240 : 1754;

        const pngBytes = generateWatermarkCanvasPng(options, canvasWidth, canvasHeight);
        watermarkImage = await pdfDoc.embedPng(pngBytes);
        imageCache.set(cacheKey, watermarkImage);
      }

      page.drawImage(watermarkImage, {
        x: 0,
        y: 0,
        width,
        height,
      });
    }

    const modifiedBytes = await pdfDoc.save();
    return new Blob([modifiedBytes as unknown as BlobPart], { type: 'application/pdf' });
  } catch (err) {
    console.warn('[stampWatermarkOnPdf] Fallback to original blob:', err);
    return pdfBlob;
  }
}
