// scripts/xuat-noi-dung-pdf.js — Xuất ra tệp .txt đúng nội dung KHO AI đang lưu cho từng văn bản
// Chỉ ĐỌC cơ sở dữ liệu, kho AI và tệp PDF; không sửa dữ liệu, không đụng tới luồng đăng tải của web.
// Kho AI chưa có nội dung của văn bản nào thì KHÔNG tạo tệp txt cho văn bản đó.
//
// Chạy ở thư mục gốc dự án, trên chính máy đang chạy dịch vụ AI:
//   node scripts/xuat-noi-dung-pdf.js                    theo dõi: AI lưu nội dung xong thì xuất 1 tệp txt
//   node scripts/xuat-noi-dung-pdf.js --moi-nhat         văn bản đăng gần nhất
//   node scripts/xuat-noi-dung-pdf.js DOC-xxxx           một văn bản theo mã file_id
//
// Đối chiếu (script TỰ đọc tệp PDF, KHÔNG phải dữ liệu chatbot đang dùng):
//   node scripts/xuat-noi-dung-pdf.js DOC-xxxx --doc-pdf
//   node scripts/xuat-noi-dung-pdf.js --tep "D:/a.pdf"
//
// Tùy chọn:
//   --mat                              cho phép xuất văn bản cấp mật 3–5 (mặc định bỏ qua)
//   Chỉ dùng khi tự đọc PDF:
//   --ocr=auto|dich-vu|tesseract|tat   auto (mặc định): dịch vụ OCR :8002, không được thì Tesseract
//   --ocr-tat-ca                       OCR mọi trang, kể cả trang đã có sẵn chữ
//   --dpi=150                          độ phân giải ảnh gửi dịch vụ OCR (72–300)
//
// Kết quả: backend/exports/noi-dung-pdf/  (thư mục này không được đưa vào Git)
// LƯU Ý: tệp txt là bản chữ thường, không có dấu chìm hay phân quyền. Kiểm tra xong nên xóa.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const UPLOADS = path.join(BACKEND, 'uploads');
const EXPORT_ROOT = path.join(BACKEND, 'exports');
const OUT_DIR = path.join(EXPORT_ROOT, 'noi-dung-pdf');
const backendRequire = createRequire(path.join(BACKEND, 'package.json'));

backendRequire('dotenv').config({ path: [path.join(ROOT, '.env'), path.join(BACKEND, '.env')], quiet: true });

const AI_STORE = process.env.AI_STORE_FILE
  || path.join(ROOT, 'boxchat', 'local_storage', 'qdrant_data', 'metadata_chunks.json');
const AI_WAIT_MS = 5 * 60 * 1000; // theo dõi: quá thời gian này mà kho AI vẫn trống thì cảnh báo
const POLL_MS = 3000;
const MIN_TEXT_CHARS = 100; // trang có ít chữ hơn mức này được coi là trang scan và đem OCR
const OCR_URL = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8002';

// ─── Tham số dòng lệnh ───────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (name, fallback) => {
  const found = argv.find((a) => a.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : fallback;
};
const fileArgAt = argv.indexOf('--tep');
const options = {
  ocr: valueOf('--ocr', 'auto'),
  ocrAll: has('--ocr-tat-ca'),
  dpi: Math.min(300, Math.max(72, parseInt(valueOf('--dpi', '150'), 10) || 150)),
  allowClassified: has('--mat'),
  fromPdf: has('--doc-pdf'),
};
const localFile = fileArgAt >= 0 ? argv[fileArgAt + 1] : null;
const wantedId = argv.find((a, i) => !a.startsWith('--') && !(fileArgAt >= 0 && i === fileArgAt + 1));

const nonSpace = (s) => (s || '').replace(/\s+/g, '').length;

// ─── Đọc lớp chữ có sẵn trong PDF (TẤT CẢ các trang) ─────────────
const wasmUrl = (() => {
  const dir = path.join(BACKEND, 'node_modules', 'pdfjs-dist', 'wasm');
  return fs.existsSync(dir) ? `${dir.split(path.sep).join('/')}/` : undefined;
})();

function buildPageText(items) {
  const parts = items
    .filter((it) => typeof it.str === 'string' && it.str.length > 0)
    .map((it) => ({
      s: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width || 0,
      h: it.height || Math.abs(it.transform[3]) || 10,
    }))
    .sort((a, b) => b.y - a.y);

  const lines = [];
  for (const p of parts) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.y - p.y) < Math.max(2, p.h * 0.4)) line.parts.push(p);
    else lines.push({ y: p.y, parts: [p] });
  }

  return lines
    .map((line) => {
      let out = '';
      let end = 0;
      for (const p of line.parts.sort((a, b) => a.x - b.x)) {
        const gap = p.x - end;
        if (out && gap > p.h * 0.18 && !/\s$/.test(out) && !/^\s/.test(p.s)) out += gap > p.h * 3 ? '    ' : ' ';
        out += p.s;
        end = p.x + p.w;
      }
      return out.trimEnd();
    })
    .filter((l) => l.trim())
    .join('\n')
    .normalize('NFC');
}

async function readTextLayer(buffer) {
  const pdfjs = await import(pathToFileURL(backendRequire.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0, wasmUrl });
  const doc = await task.promise;
  const pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      try {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        pages.push({ number: n, text: buildPageText(content.items) });
        page.cleanup();
      } catch (e) {
        pages.push({ number: n, text: '', error: `không đọc được lớp chữ: ${e.message}` });
      }
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

// Chữ lỗi phông (TCVN3/VNI cũ...) — cùng cách nhận biết như backend/pdf-parser.js
function isGarbage(text) {
  const t = (text || '').trim();
  if (t.length < 50) return false;
  let odd = 0;
  for (const ch of t) {
    const code = ch.charCodeAt(0);
    if (code >= 0xa0 && code <= 0xbf) odd++;
  }
  if (odd / t.length > 0.03) return true;
  const meaningful = t.split(/\s+/).filter((w) => /^[a-zA-Z0-9À-ỹ]{2,}$/.test(w));
  return meaningful.reduce((sum, w) => sum + w.length, 0) / t.length < 0.3;
}

// ─── OCR ─────────────────────────────────────────────────────────
let serviceDown = false;
let tesseractWorker = null;

async function ocrByService(buffer, pageNumber) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), 'tai-lieu.pdf');
  form.append('pages', JSON.stringify([pageNumber]));
  form.append('dpi', String(options.dpi));
  let res;
  try {
    res = await fetch(`${OCR_URL}/api/ocr/extract`, { method: 'POST', body: form, signal: AbortSignal.timeout(180000) });
  } catch (e) {
    if (e.name !== 'TimeoutError') serviceDown = true;
    throw new Error(e.name === 'TimeoutError' ? 'dịch vụ OCR quá 180 giây' : `không kết nối được dịch vụ OCR ${OCR_URL}`);
  }
  if (!res.ok) throw new Error(`dịch vụ OCR trả mã ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'dịch vụ OCR báo lỗi');
  return { text: (data.combined_text || '').normalize('NFC'), engine: data.engine_used || 'dịch vụ OCR' };
}

async function ocrByTesseract(images, pageNumber) {
  if (!tesseractWorker) {
    const { createWorker } = backendRequire('tesseract.js');
    const local = ['vie', 'eng'].every((l) => fs.existsSync(path.join(BACKEND, `${l}.traineddata`)));
    tesseractWorker = await createWorker('vie+eng', 1, local
      ? { langPath: BACKEND, gzip: false, cacheMethod: 'none' }
      : {});
  }
  const image = await images.getPage(pageNumber);
  const { data } = await tesseractWorker.recognize(image);
  return { text: (data.text || '').normalize('NFC'), engine: `tesseract (tin cậy ${Math.round(data.confidence || 0)}%)` };
}

async function openImages(buffer) {
  const entry = path.join(BACKEND, 'node_modules', 'pdf-to-img', 'dist', 'index.js');
  const { pdf } = await import(pathToFileURL(entry).href);
  return pdf(Buffer.from(buffer), { scale: 3, docInitParams: wasmUrl ? { wasmUrl } : {} });
}

// ─── Đọc toàn bộ tài liệu ────────────────────────────────────────
async function readWholePdf(buffer) {
  const pages = await readTextLayer(buffer);
  let images = null;
  try {
    for (const page of pages) {
      const garbage = isGarbage(page.text);
      const needOcr = options.ocrAll || garbage || nonSpace(page.text) < MIN_TEXT_CHARS;
      page.source = 'chữ có sẵn trong PDF';
      page.notes = page.error ? [page.error] : [];
      if (garbage) page.notes.push('lớp chữ có dấu hiệu lỗi phông');
      if (!needOcr || options.ocr === 'tat') continue;

      process.stdout.write(`   OCR trang ${page.number}/${pages.length}...\r`);
      let result = null;
      if (options.ocr !== 'tesseract' && !serviceDown) {
        try {
          result = await ocrByService(buffer, page.number);
        } catch (e) {
          page.notes.push(e.message);
        }
      }
      if ((!result || !result.text.trim()) && options.ocr !== 'dich-vu') {
        try {
          images = images || (await openImages(buffer));
          result = await ocrByTesseract(images, page.number);
        } catch (e) {
          page.notes.push(`Tesseract lỗi: ${e.message}`);
        }
      }
      // Trang vốn có ít chữ: chỉ thay khi OCR đọc được nhiều hơn (hoặc lớp chữ bị lỗi phông)
      if (result && result.text.trim() && (options.ocrAll || garbage || nonSpace(result.text) > nonSpace(page.text))) {
        page.text = result.text.trim();
        page.source = `OCR: ${result.engine}`;
      }
    }
  } finally {
    if (images) await images.destroy().catch(() => {});
  }
  return pages;
}

function writeReport(meta, buffer, pages) {
  const sha = crypto.createHash('sha256').update(buffer).digest('hex');
  const empty = pages.filter((p) => !p.text.trim()).map((p) => p.number);
  const ocrPages = pages.filter((p) => p.source.startsWith('OCR'));
  const paddle = ocrPages.filter((p) => /paddle/i.test(p.source)).map((p) => p.number);
  const total = pages.reduce((sum, p) => sum + nonSpace(p.text), 0);

  const head = [
    'KIỂM TRA NỘI DUNG PDF',
    `Thời điểm xuất      : ${new Date().toLocaleString('vi-VN')}`,
    ...meta.lines,
    `SHA-256 tệp         : ${sha}`,
    meta.dbSha ? `Đối chiếu CSDL      : ${meta.dbSha === sha ? 'KHỚP (tệp lưu đúng nguyên vẹn)' : 'KHÔNG KHỚP với mã băm trong CSDL'}` : null,
    `Số trang            : ${pages.length}`,
    `Trang đọc chữ có sẵn: ${pages.length - ocrPages.length - empty.length}`,
    `Trang đọc bằng OCR  : ${ocrPages.length}${ocrPages.length ? ` (trang ${ocrPages.map((p) => p.number).join(', ')})` : ''}`,
    `Trang không có chữ  : ${empty.length}${empty.length ? ` (trang ${empty.join(', ')})` : ''}`,
    `Tổng ký tự          : ${total} (không tính khoảng trắng)`,
    paddle.length ? `CẢNH BÁO            : trang ${paddle.join(', ')} đọc bằng PaddleOCR; bộ chữ "latin" thiếu nhiều chữ tiếng Việt có dấu. Chạy lại với --ocr=tesseract để so sánh.` : null,
    'Ghi chú             : đây là chữ do script TỰ đọc từ tệp PDF, KHÔNG phải dữ liệu chatbot đang dùng.',
  ].filter(Boolean);

  const body = pages.map((p) => [
    '',
    `==================== TRANG ${p.number}/${pages.length} — ${p.text.trim() ? p.source : 'KHÔNG CÓ CHỮ'} ====================`,
    ...p.notes.map((n) => `[ghi chú] ${n}`),
    p.text,
  ].join('\n'));

  const outFile = saveText(meta.name, `${head.join('\n')}\n${body.join('\n')}\n`);
  console.log(`✔ ${pages.length} trang, ${total} ký tự (OCR ${ocrPages.length}, trống ${empty.length})`);
  console.log(`  → ${outFile}`);
}

function saveText(name, content) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ignore = path.join(EXPORT_ROOT, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const safeName = name.replace(/[^A-Za-z0-9À-ỹ._-]+/g, '-').slice(0, 90);
  const outFile = path.join(OUT_DIR, `${safeName}_${stamp}.txt`);
  // Ký tự BOM để Notepad hiển thị đúng tiếng Việt
  fs.writeFileSync(outFile, String.fromCharCode(0xfeff) + content.replace(/\r?\n/g, '\r\n'), 'utf8');
  return outFile;
}

// ─── Kho AI (dữ liệu chatbot đang dùng) ──────────────────────────
function readStore() {
  if (!fs.existsSync(AI_STORE)) throw new Error(`Không thấy kho AI: ${AI_STORE}`);
  const byFile = new Map();
  for (const chunk of JSON.parse(fs.readFileSync(AI_STORE, 'utf8'))) {
    if (!byFile.has(chunk.file_id)) byFile.set(chunk.file_id, []);
    byFile.get(chunk.file_id).push(chunk);
  }
  return byFile;
}

const fingerprint = (chunks) => crypto.createHash('sha256')
  .update(JSON.stringify(chunks.map((c) => [c.page, c.text, c.security_level_id])))
  .digest('hex');

async function writeStoreReport(meta, chunks, pdfPath) {
  const sorted = [...chunks].sort((a, b) => Number(a.page) - Number(b.page)); // sort ổn định: giữ thứ tự đoạn trong trang
  const stored = [...new Set(sorted.map((c) => Number(c.page)))];
  let pageCount = 0;
  if (pdfPath) {
    pageCount = await readTextLayer(fs.readFileSync(pdfPath)).then((p) => p.length).catch(() => 0);
  }
  const missing = Array.from({ length: pageCount }, (_, i) => i + 1).filter((n) => !stored.includes(n));
  const total = sorted.reduce((sum, c) => sum + nonSpace(c.text), 0);

  const head = [
    'NỘI DUNG ĐANG LƯU TRONG KHO AI (dữ liệu chatbot dùng để tìm và trả lời)',
    `Thời điểm xuất      : ${new Date().toLocaleString('vi-VN')}`,
    ...meta.lines,
    `Số đoạn trong kho   : ${sorted.length}`,
    `Số trang của PDF    : ${pageCount || 'không xác định (không mở được tệp)'}`,
    `Trang có trong kho  : ${stored.length} (trang ${stored.join(', ')})`,
    pageCount ? `Trang kho AI THIẾU  : ${missing.length}${missing.length ? ` (trang ${missing.join(', ')})` : ''}` : null,
    `Tổng ký tự          : ${total} (không tính khoảng trắng)`,
    'Ghi chú             : chữ in nguyên như kho AI lưu, script không đọc hay sửa lại. Trang có trong kho vẫn có thể thiếu chữ.',
  ].filter(Boolean);

  const body = [];
  let page = null;
  sorted.forEach((c, i) => {
    if (Number(c.page) !== page) {
      page = Number(c.page);
      body.push('', `==================== TRANG ${page}${pageCount ? `/${pageCount}` : ''} ====================`);
    }
    body.push(`--- đoạn ${i + 1}/${sorted.length} ---`, String(c.text || '').normalize('NFC'));
  });

  const outFile = saveText(`${meta.name}_kho-AI`, `${head.join('\n')}\n${body.join('\n')}\n`);
  console.log(`✔ Kho AI: ${sorted.length} đoạn, ${total} ký tự${missing.length ? `, THIẾU ${missing.length}/${pageCount} trang` : ''}`);
  console.log(`  → ${outFile}`);
}

async function exportFile(absPath, meta) {
  const buffer = fs.readFileSync(absPath);
  const pages = await readWholePdf(buffer);
  writeReport(meta, buffer, pages);
}

// ─── Văn bản trong cơ sở dữ liệu ─────────────────────────────────
const DOC_QUERY = `
  SELECT file_id, document_code, title, original_name, stored_path, sha256, security_level_id,
         deleted_at, deleted_reason, created_at, CAST(N'Văn bản' AS NVARCHAR(40)) AS kind
  FROM DOCUMENT`;

const PROPOSAL_QUERY = `
  SELECT p.file_id, p.document_code, p.title, p.new_original_name, p.new_stored_path, p.new_sha256,
         CASE WHEN p.security_level_id > d.security_level_id THEN p.security_level_id ELSE d.security_level_id END,
         NULL, NULL, p.created_at, CAST(N'Đề xuất sửa chờ duyệt' AS NVARCHAR(40))
  FROM DOCUMENT_REVISION_PROPOSAL p
  JOIN DOCUMENT d ON d.file_id = p.file_id
  WHERE p.new_stored_path IS NOT NULL AND p.status IN ('PENDING', 'PENDING_OWNER')`;

const isVisible = (d) => !d.deleted_at || d.deleted_reason === 'PENDING_APPROVAL';
const keyOf = (d) => `${d.file_id}|${d.stored_path}|${String(d.sha256 || '').trim()}`;

function locate(storedPath) {
  const p = String(storedPath || '');
  const candidates = [p, p.replace('uploads/2026/', 'uploads/van-ban-so/2026/'), p.replace('uploads/van-ban-so/2026/', 'uploads/2026/')];
  return candidates
    .map((c) => path.resolve(BACKEND, c))
    .find((abs) => abs.startsWith(UPLOADS + path.sep) && fs.existsSync(abs)) || null;
}

async function exportDocument(d, store) {
  console.log(`\n▶ ${d.kind}: ${d.file_id} — ${d.document_code || '(không số hiệu)'} — cấp mật ${d.security_level_id}`);
  const chunks = options.fromPdf ? [] : (store || readStore()).get(d.file_id) || [];
  // Lấy cấp cao nhất giữa cơ sở dữ liệu và kho AI (phòng khi hai nơi lệch nhau)
  const level = Math.max(Number(d.security_level_id), ...chunks.map((c) => Number(c.security_level_id) || 0));
  if (!(level >= 1 && level <= 2) && !options.allowClassified) {
    console.log('  Bỏ qua: văn bản cấp mật 3–5. Chỉ xuất khi chạy kèm --mat.');
    return;
  }
  if (!options.fromPdf && !chunks.length) {
    console.log('  ✖ Kho AI CHƯA lưu nội dung nào của văn bản này, nên chatbot không đọc được. Không tạo tệp txt.');
    if (d.deleted_reason === 'PENDING_APPROVAL') console.log('    (đang chờ duyệt: AI chỉ đọc sau khi văn bản được duyệt)');
    return;
  }
  const abs = locate(d.stored_path);
  if (!abs && options.fromPdf) {
    console.log(`  Không tìm thấy tệp trên đĩa: ${d.stored_path}`);
    return;
  }
  const meta = {
    name: `${d.file_id}_${d.document_code || 'khong-so-hieu'}`,
    dbSha: String(d.sha256 || '').trim().toLowerCase(),
    lines: [
      `Loại                : ${d.kind}${d.deleted_reason === 'PENDING_APPROVAL' ? ' (đăng mới, đang chờ duyệt)' : ''}`,
      `Mã văn bản          : ${d.file_id}`,
      `Số hiệu             : ${d.document_code || ''}`,
      `Trích yếu           : ${d.title || ''}`,
      `Tên tệp gốc         : ${d.original_name || ''}`,
      `Đường dẫn lưu       : ${d.stored_path}`,
      `Cấp mật             : ${d.security_level_id}`,
    ],
  };
  if (options.fromPdf) await exportFile(abs, meta);
  else await writeStoreReport(meta, chunks, abs);
}

// Theo dõi kho AI: văn bản nào được AI lưu mới hoặc lưu lại thì xuất txt
async function watchStore(query, findById) {
  const seen = new Map([...readStore()].map(([id, chunks]) => [id, fingerprint(chunks)]));
  const known = new Set((await query(DOC_QUERY)).map(keyOf));
  const waiting = new Map();
  console.log('Đang theo dõi kho AI. Hãy quét và bấm Lưu trên web; nhấn Ctrl+C để dừng.');

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    try {
      for (const d of await query(DOC_QUERY)) {
        if (known.has(keyOf(d)) || !isVisible(d)) continue;
        if (d.deleted_reason === 'PENDING_APPROVAL') {
          if (!waiting.has(d.file_id)) console.log(`\n… ${d.document_code || d.file_id} đang chờ duyệt; AI chỉ đọc sau khi duyệt.`);
          waiting.set(d.file_id, { d, since: null });
          continue;
        }
        known.add(keyOf(d));
        console.log(`\n… Văn bản mới ${d.document_code || d.file_id}: đang chờ AI đọc và lưu.`);
        waiting.set(d.file_id, { d, since: Date.now() });
      }

      const store = readStore();
      for (const [id, chunks] of store) {
        const mark = fingerprint(chunks);
        if (seen.get(id) === mark) continue;
        const d = await findById(id);
        if (d) await exportDocument(d, store);
        seen.set(id, mark);
        waiting.delete(id);
      }

      for (const [id, { d, since }] of waiting) {
        if (since && Date.now() - since > AI_WAIT_MS) {
          console.log(`\n✖ ${d.document_code || id}: sau ${AI_WAIT_MS / 60000} phút kho AI vẫn chưa có nội dung. Kiểm tra dịch vụ AI (:8001) và OCR (:8002).`);
          waiting.delete(id);
        }
      }
    } catch (e) {
      console.error('Lỗi khi theo dõi (sẽ thử lại):', e.message);
    }
  }
}

async function cleanup(closePool) {
  if (tesseractWorker) await tesseractWorker.terminate().catch(() => {});
  tesseractWorker = null;
  if (closePool) await closePool();
}

async function main() {
  if (!['auto', 'dich-vu', 'tesseract', 'tat'].includes(options.ocr)) {
    throw new Error('--ocr chỉ nhận: auto, dich-vu, tesseract, tat');
  }

  if (fileArgAt >= 0) {
    if (!localFile || !fs.existsSync(localFile)) throw new Error('Thiếu hoặc sai đường dẫn sau --tep');
    const abs = path.resolve(localFile);
    await exportFile(abs, { name: path.basename(abs, path.extname(abs)), lines: [`Tệp                 : ${abs}`] });
    await cleanup();
    return;
  }

  const { sql, getPool, closePool } = backendRequire('./src/db');
  const query = async (text) => (await (await getPool()).request().query(text)).recordset;
  const findById = async (id) => {
    const request = (await getPool()).request().input('id', sql.VarChar(50), id);
    return (await request.query(`${DOC_QUERY} WHERE file_id = @id`)).recordset[0];
  };

  if (has('--moi-nhat') || wantedId) {
    let rows;
    if (wantedId) {
      rows = [await findById(wantedId)].filter(Boolean);
    } else {
      rows = await query(`SELECT TOP 1 * FROM (${DOC_QUERY}
        WHERE deleted_at IS NULL OR deleted_reason = 'PENDING_APPROVAL') x ORDER BY created_at DESC`);
    }
    if (!rows.length) console.log('Không tìm thấy văn bản.');
    else await exportDocument(rows[0]);
    await cleanup(closePool);
    return;
  }

  process.on('SIGINT', () => cleanup(closePool).finally(() => process.exit(0)));
  if (!options.fromPdf) {
    await watchStore(query, findById);
    return;
  }

  // Chế độ theo dõi kèm --doc-pdf: ghi nhớ những gì đã có, chỉ xuất tệp xuất hiện sau đó
  const snapshot = async () => [...(await query(DOC_QUERY)), ...(await query(PROPOSAL_QUERY))];
  const seen = new Set((await snapshot()).map(keyOf));
  console.log('Đang theo dõi (tự đọc PDF). Hãy quét và bấm Lưu trên web; nhấn Ctrl+C để dừng.');

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    try {
      for (const d of await snapshot()) {
        const key = keyOf(d);
        if (seen.has(key)) continue;
        seen.add(key);
        if (!isVisible(d)) continue;
        serviceDown = false; // mỗi tài liệu thử lại dịch vụ OCR
        await exportDocument(d);
        console.log('Đang theo dõi tiếp...');
      }
    } catch (e) {
      console.error('Lỗi khi theo dõi (sẽ thử lại):', e.message);
    }
  }
}

main().catch(async (e) => {
  console.error('Lỗi:', e.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
