// backend/src/library-media.js
// ═══════════════════════════════════════════════════════════════════════
// Số trang và ảnh bìa của tài liệu Thư viện số.
//   • inspectPdf(buffer)          → { pageCount, cover }  bìa = ảnh trang 1
//   • coverFromImage(buffer)      → ảnh bìa do người đăng chọn (JPG, PNG, WebP)
// Vẽ trang PDF tốn CPU nên chạy ở luồng phụ, lần lượt từng tệp, để không làm đứng máy chủ.
// Mọi ảnh đều được mã hóa lại thành JPEG thu nhỏ (bỏ siêu dữ liệu, không lưu tệp gốc người dùng gửi).
// ═══════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const TASK = 'library-media';
const COVER_WIDTH = 360;
const COVER_HEIGHT = 510;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const RENDER_TIMEOUT_MS = parseInt(process.env.LIBRARY_COVER_TIMEOUT_MS || '30000', 10);
const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);

// ─── Luồng phụ: đếm trang rồi vẽ trang 1 ──────────────────────
async function renderInWorker() {
  try {
    // Dùng thẳng pdf.js để khai báo wasm (giải ảnh scan JBIG2 / JPEG 2000), phông chuẩn và cmap cục bộ
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const root = path.dirname(require.resolve('pdfjs-dist/package.json'));
    const assets = (name) => `${path.join(root, name)}/`;
    const doc = await pdfjs.getDocument({
      data: workerData.data,
      wasmUrl: assets('wasm'),
      standardFontDataUrl: assets('standard_fonts'),
      cMapUrl: assets('cmaps'),
      cMapPacked: true,
      isEvalSupported: false, // tệp do người dùng gửi lên: không cho chạy mã
      disableFontFace: true,
      verbosity: 0,
    }).promise;
    parentPort.postMessage({ pageCount: doc.numPages }); // gửi trước: vẽ lỗi vẫn có số trang
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, (COVER_WIDTH * 2) / base.width) });
    const { canvas, context } = doc.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    parentPort.postMessage({ png: canvas.toBuffer('image/png') });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
  parentPort.close();
}

// ─── Luồng chính ──────────────────────────────────────────────
function runWorker(buffer) {
  return new Promise((resolve) => {
    const result = { pageCount: null, png: null };
    let worker;
    let done = false;
    const finish = (reason) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (reason) console.warn('[library-media]', reason);
      worker?.terminate().catch(() => {});
      resolve(result);
    };
    const timer = setTimeout(() => finish(`vẽ trang 1 quá ${RENDER_TIMEOUT_MS} ms`), RENDER_TIMEOUT_MS);
    try {
      worker = new Worker(__filename, { workerData: { task: TASK, data: new Uint8Array(buffer) } });
    } catch (err) {
      finish(err.message);
      return;
    }
    worker.on('message', (msg) => {
      if (msg.pageCount) result.pageCount = msg.pageCount;
      if (msg.png) { result.png = Buffer.from(msg.png); finish(); }
      if (msg.error) finish(msg.error);
    });
    worker.on('error', (err) => finish(err.message));
    worker.on('exit', () => finish());
  });
}

const toCoverJpeg = (input) => require('sharp')(input, { limitInputPixels: 50e6 })
  .rotate() // theo hướng chụp trong ảnh
  .resize(COVER_WIDTH, COVER_HEIGHT, { fit: 'inside', withoutEnlargement: true })
  .flatten({ background: '#ffffff' })
  .jpeg({ quality: 80 })
  .toBuffer();

let queue = Promise.resolve();

/** Không bao giờ ném lỗi: không đọc được thì trả null, tài liệu vẫn đăng được (không có bìa) */
function inspectPdf(buffer) {
  const job = queue.then(async () => {
    const { pageCount, png } = await runWorker(buffer);
    let count = pageCount;
    if (!count) {
      try {
        const { PDFDocument } = require('pdf-lib');
        count = (await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false })).getPageCount() || null;
      } catch (err) {
        console.warn('[library-media] không đếm được số trang:', err.message);
      }
    }
    let cover = null;
    if (png) {
      try { cover = await toCoverJpeg(png); } catch (err) { console.warn('[library-media] tạo bìa lỗi:', err.message); }
    }
    return { pageCount: count, cover };
  });
  queue = job.catch(() => {});
  return job;
}

/** Ảnh người đăng chọn. Trả null nếu không phải ảnh JPG, PNG, WebP hợp lệ trong giới hạn */
async function coverFromImage(buffer) {
  if (!buffer?.length || buffer.length > MAX_COVER_BYTES) return null;
  try {
    const meta = await require('sharp')(buffer, { limitInputPixels: 50e6 }).metadata();
    if (!IMAGE_FORMATS.has(meta.format)) return null;
    return await toCoverJpeg(buffer);
  } catch (_) {
    return null;
  }
}

if (!isMainThread && workerData?.task === TASK) renderInWorker();

module.exports = { inspectPdf, coverFromImage, MAX_COVER_BYTES };
