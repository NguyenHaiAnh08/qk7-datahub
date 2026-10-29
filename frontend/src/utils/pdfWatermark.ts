import { PDFDocument } from 'pdf-lib';

export interface WatermarkOptions {
  userDisplayName: string;
  timeStr: string;
  opacity?: number;
}

/**
 * Sinh ra 1 ảnh Canvas chứa 4 watermark trải đều các khung/vị trí trên trang A4:
 * - Khung 1: Đầu trang (18%)
 * - Khung 2: Thân trên (38%)
 * - Khung 3: Thân dưới (62%)
 * - Khung 4: Chân trang (82%)
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

  const text = `${options.userDisplayName} - ${options.timeStr}`;
  const angle = -25 * (Math.PI / 180); // Nghiêng góc -25 độ chuẩn quân sự

  // 4 vị trí trải đều các khung từ trên xuống dưới
  const yPositions = [0.18, 0.38, 0.62, 0.82];

  ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace';
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
 * Giúp watermark dính "cứng theo tài liệu", khi phóng to/thu nhỏ (zoom in/zoom out),
 * watermark luôn co giãn chính xác theo trang giấy và không bao giờ tràn ra ngoài nền đen.
 */
export async function stampWatermarkOnPdf(
  pdfBlob: Blob,
  options: WatermarkOptions
): Promise<Blob> {
  try {
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    // Tạo PNG chứa 4 watermark trải đều các khung
    const pngBytes = generateWatermarkCanvasPng(options, 1240, 1754);
    const watermarkImage = await pdfDoc.embedPng(pngBytes);

    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();
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
