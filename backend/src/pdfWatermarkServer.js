import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs/promises';
import path from 'node:path';

let fontBytesPromise = null;

async function loadFontBytes() {
  if (!fontBytesPromise) {
    fontBytesPromise = fs.readFile(
      path.join(process.cwd(), 'assets/fonts/Roboto-Regular.ttf')
    );
  }
  return fontBytesPromise;
}

function safeText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatServerDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Stamp watermark server-side.
 * @param {Buffer|Uint8Array} inputBuffer PDF gốc
 * @param {object} meta
 * @param {string} meta.userDisplayName
 * @param {string} meta.timeStr
 * @param {string} meta.traceId
 * @param {number} [meta.opacity]
 * @returns {Promise<Buffer>}
 */
export async function stampPdfWatermark(
  inputBuffer,
  { userDisplayName, timeStr, traceId, opacity = 0.18 }
) {
  const pdfDoc = await PDFDocument.load(inputBuffer);

  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(await loadFontBytes(), { subset: true });

  const viewer = safeText(userDisplayName) || 'UNKNOWN';
  const time = safeText(timeStr);
  const ref = safeText(traceId);

  const lines = [
    'QK7 - TÀI LIỆU NỘI BỘ',
    `Người xem: ${viewer}`,
    `Thời gian: ${time}`,
    `Mã vết: ${ref}`,
  ];

  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    const fontSize = Math.min(28, Math.max(14, width / 32));
    const lineHeight = fontSize * 1.35;
    const totalHeight = lineHeight * (lines.length - 1);

    lines.forEach((line, index) => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      const y =
        height / 2 -
        totalHeight / 2 +
        (lines.length - 1 - index) * lineHeight;

      page.drawText(line, {
        x: width / 2 - textWidth / 2,
        y,
        size: fontSize,
        font,
        color: rgb(0.85, 0.08, 0.08),
        opacity,
        rotate: degrees(45),
      });
    });

    const footer = `REF: ${ref} | ${time}`;
    page.drawText(footer, {
      x: 36,
      y: 18,
      size: 7,
      font,
      color: rgb(0.45, 0.45, 0.45),
      opacity: Math.min(0.65, opacity + 0.25),
    });
  }

  // Metadata truy vết phụ
  pdfDoc.setSubject(`TraceId=${ref}; Viewer=${viewer}; Time=${time}`);
  pdfDoc.setKeywords([ref]);
  pdfDoc.setProducer('QK7 Secure PDF Server');
  pdfDoc.setCreator('QK7 Document System');

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return Buffer.from(bytes);
}