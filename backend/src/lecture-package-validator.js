// backend/src/lecture-package-validator.js
// Kiểm tra gói bài giảng ActivePresenter (HTML5 / SCORM) trước khi nhận và trước khi giải nén.
//
// Mối đe dọa: người khác mở gói ZIP gốc, thêm tệp mã độc hoặc chèn script rồi tải lên.
// Nguyên tắc: CHỈ NHẬN những gì nhận diện được, mọi thứ còn lại đều từ chối.
//   1. Trình phát (player/*) và lược đồ SCORM: phải trùng mã băm trong danh sách tin cậy.
//   2. rlprez.js (dữ liệu bài): chỉ được là khai báo dữ liệu, không có hàm hay lời gọi nào khác.
//      Hành động "chạy JavaScript" của ActivePresenter nằm trong mảng f → bị cấm.
//   3. Trang HTML: phải trùng khuôn tin cậy, chỉ khác ở một số ô được kiểm soát chặt.
//   4. Tệp phương tiện: đuôi cho phép và nội dung khớp đuôi.
// Giới hạn: đây không phải trình diệt virus, và không chứng minh được nội dung bài còn nguyên bản.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');

const TRUSTED_FILE = path.join(__dirname, 'ap-trusted-runtime.json');
const MAX_ENTRIES = 5000;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;
const MAX_ISSUES = 20;
const ALLOWED_PREFIXES = ['', 'HTML5/'];
const PAGE_NAMES = ['index.html', 'demo.html', 'tutorial.html', 'practice.html', 'test.html'];
const IGNORED_FILES = new Set(['.htaccess']); // cấu hình Apache, máy chủ không dùng → không giải nén

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function loadTrusted(file = TRUSTED_FILE) {
  const t = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { player: t.player || {}, schemas: t.schemas || {}, pages: t.pages || [] };
}

// ─── Văn bản ───────────────────────────────────────────────────────────────
// Chỉ nhận UTF-8 không có byte 0 — chặn tệp UTF-16 mà trình duyệt đọc được còn bộ lọc thì không.
function decodeText(buf) {
  if (buf.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf); // tự bỏ BOM
  } catch {
    return null;
  }
}

function decodeEntities(s) {
  const named = { colon: ':', tab: '\t', newline: '\n', lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => (parseInt(h, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(h, 16)) : m))
    .replace(/&#(\d+);?/g, (m, d) => (Number(d) <= 0x10ffff ? String.fromCodePoint(Number(d)) : m))
    .replace(/&(colon|tab|newline|lt|gt|amp|quot|apos);/gi, (m, n) => named[n.toLowerCase()]);
}

// Dấu hiệu mã thực thi trong một chuỗi sẽ được trình phát hiển thị hoặc mở như địa chỉ
function findActiveContent(str) {
  if (/<(?:[\w-]+:)?(script|iframe|object|embed|applet|frame|frameset|meta|base|link|form|foreignobject)(?=[\s/>])/i.test(str)) {
    return 'thẻ HTML thực thi được (script, iframe, object, form...)';
  }
  if (/<[a-z]/i.test(str) && /[\s/"'`]on[a-z]{3,}\s*=/i.test(str)) return 'thuộc tính sự kiện (onclick, onerror...)';
  const flat = decodeEntities(str).replace(/[\t\r\n]/g, '');
  if (/^[\u0000- ]*(javascript|vbscript)\s*:/i.test(flat)
    || /(?:href|src|action|data|from|to|values)\s*=\s*["']?[\u0000- ]*(javascript|vbscript)\s*:/i.test(flat)) {
    return 'địa chỉ javascript:';
  }
  if (/^[\u0000- ]*data\s*:\s*text\/html/i.test(flat)
    || /(?:href|src|action|data)\s*=\s*["']?[\u0000- ]*data\s*:\s*text\/html/i.test(flat)) {
    return 'địa chỉ data:text/html';
  }
  return null;
}

// ─── rlprez.js: chỉ cho phép khai báo dữ liệu ──────────────────────────────
// Ngữ pháp được chấp nhận (đúng với tệp ActivePresenter xuất ra), ngoài ra đều từ chối:
//   (function(AP) { var $, jQuery; $ = jQuery = AP.$;
//     var d = {…}, f = []; d.f = f; d.<tên> = <giá trị>; … AP.loadedPrezs.push(d); })(AtomiAP);
class DataScriptError extends Error {}

function tokenizeDataScript(src) {
  const tokens = [];
  const n = src.length;
  const isLineEnd = (c) => c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029';
  const fail = (msg, at) => {
    const line = src.slice(0, at).split(/\r\n|\r|\n|\u2028|\u2029/).length;
    throw new DataScriptError(`${msg} (dòng ${line})`);
  };
  const idStart = /[A-Za-z_$]/;
  const idPart = /[A-Za-z0-9_$]/;
  const numRe = /(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  let i = src.charCodeAt(0) === 0xfeff ? 1 : 0;

  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && !isLineEnd(src[i])) i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) fail('Chú thích chưa đóng', i);
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let value = '';
      let j = i + 1;
      for (;;) {
        if (j >= n || src[j] === '\n' || src[j] === '\r') fail('Chuỗi chưa đóng', i);
        const ch = src[j];
        if (ch === c) break;
        if (ch !== '\\') { value += ch; j++; continue; }
        const e = src[j + 1];
        if (e === undefined) fail('Chuỗi chưa đóng', i);
        let m;
        if (e === 'x' && (m = /^[0-9a-fA-F]{2}/.exec(src.slice(j + 2, j + 4)))) {
          value += String.fromCharCode(parseInt(m[0], 16)); j += 4;
        } else if (e === 'u' && (m = /^(?:([0-9a-fA-F]{4})|\{([0-9a-fA-F]{1,6})\})/.exec(src.slice(j + 2, j + 10)))) {
          const code = parseInt(m[1] || m[2], 16);
          if (code > 0x10ffff) fail('Mã ký tự không hợp lệ', j);
          value += String.fromCodePoint(code); j += 2 + m[0].length;
        } else if (e === 'x' || e === 'u' || /[1-9]/.test(e) || (e === '0' && /\d/.test(src[j + 2] || ''))) {
          fail('Ký tự thoát không hợp lệ', j);
        } else if (e === '\r' && src[j + 2] === '\n') {
          j += 3;
        } else if (isLineEnd(e)) {
          j += 2;
        } else {
          const simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' };
          value += Object.prototype.hasOwnProperty.call(simple, e) ? simple[e] : e;
          j += 2;
        }
      }
      tokens.push({ t: 'str', v: value, at: i });
      i = j + 1;
      continue;
    }
    if (c >= '0' && c <= '9') {
      numRe.lastIndex = i;
      const m = numRe.exec(src);
      const next = src[i + m[0].length] || '';
      if (idPart.test(next) || next === '.') fail('Số không hợp lệ', i);
      tokens.push({ t: 'num', v: m[0], at: i });
      i += m[0].length;
      continue;
    }
    if (idStart.test(c)) {
      let j = i + 1;
      while (j < n && idPart.test(src[j])) j++;
      tokens.push({ t: 'id', v: src.slice(i, j), at: i });
      i = j;
      continue;
    }
    if ('(){}[],:;.=-'.includes(c)) { tokens.push({ t: c, v: c, at: i }); i++; continue; }
    fail(`Ký tự không được phép "${c}"`, i);
  }
  tokens.push({ t: 'eof', v: '', at: n });
  return { tokens, fail };
}

function checkDataScript(src) {
  const { tokens, fail } = tokenizeDataScript(src);
  let p = 0;
  const peek = () => tokens[p];
  const next = () => tokens[p++];
  const expect = (...words) => {
    for (const w of words) {
      const tk = next();
      if (tk.v !== w || tk.t === 'str') fail(`Có lệnh lạ trong dữ liệu bài: gặp "${String(tk.v).slice(0, 30)}", cần "${w}"`, tk.at);
    }
  };
  const checkString = (tk) => {
    const bad = findActiveContent(tk.v);
    if (bad) fail(`Chuỗi dữ liệu chứa ${bad}`, tk.at);
  };
  const checkKey = (tk) => {
    if (tk.v === '__proto__') fail('Khóa __proto__ không được phép', tk.at);
  };

  function value(depth) {
    if (depth > 200) fail('Dữ liệu lồng quá sâu', peek().at);
    const tk = next();
    if (tk.t === 'str') return checkString(tk);
    if (tk.t === 'num') return undefined;
    if (tk.t === '-') {
      const num = next();
      if (num.t !== 'num') fail('Sau dấu trừ phải là số', num.at);
      return undefined;
    }
    if (tk.t === 'id' && ['true', 'false', 'null'].includes(tk.v)) return undefined;
    if (tk.t === '[') {
      while (peek().t !== ']') {
        if (peek().t === ',') { next(); continue; }
        value(depth + 1);
        if (peek().t !== ']' && peek().t !== ',') fail('Mảng dữ liệu sai cú pháp (có thể bị chèn mã)', peek().at);
      }
      next();
      return undefined;
    }
    if (tk.t === '{') {
      while (peek().t !== '}') {
        const key = next();
        if (!['id', 'str', 'num'].includes(key.t)) fail('Khóa dữ liệu không hợp lệ', key.at);
        checkKey(key);
        if (key.t === 'str') checkString(key);
        expect(':');
        value(depth + 1);
        if (peek().t === ',') next();
        else if (peek().t !== '}') fail('Đối tượng dữ liệu sai cú pháp (có thể bị chèn mã)', peek().at);
      }
      next();
      return undefined;
    }
    return fail(
      tk.v === 'function'
        ? 'Dữ liệu bài chứa hàm (hành động chạy JavaScript hoặc mã bị chèn)'
        : `Giá trị không được phép "${String(tk.v).slice(0, 30)}"`,
      tk.at,
    );
  }

  expect('(', 'function', '(', 'AP', ')', '{');
  expect('var', '$', ',', 'jQuery', ';');
  expect('$', '=', 'jQuery', '=', 'AP', '.', '$', ';');
  expect('var', 'd', '=');
  if (peek().t !== '{') fail('Biến d phải là đối tượng dữ liệu', peek().at);
  value(0);
  expect(',', 'f', '=', '[');
  if (peek().t !== ']') {
    fail('Bài có hành động "chạy JavaScript" (mảng f không rỗng) — không được phép', peek().at);
  }
  expect(']', ';');
  while (peek().t === 'id' && peek().v === 'd') {
    next();
    expect('.');
    const key = next();
    if (key.t !== 'id') fail('Tên thuộc tính không hợp lệ', key.at);
    checkKey(key);
    expect('=');
    if (key.v === 'f') expect('f');
    else value(0);
    expect(';');
  }
  expect('AP', '.', 'loadedPrezs', '.', 'push', '(', 'd', ')', ';');
  expect('}', ')', '(', 'AtomiAP', ')', ';');
  if (peek().t !== 'eof') fail('Có mã nằm sau phần dữ liệu bài', peek().at);
}

// ─── Trang HTML: so khuôn ──────────────────────────────────────────────────
// Thay các ô được phép khác nhau giữa các bài bằng ký hiệu §; phần còn lại phải trùng tuyệt đối.
// Ô nào không đúng dạng thì giữ nguyên → mã băm khác → bị từ chối.
function pageSkeleton(text) {
  let s = text
    .replace(/^\ufeff/, '')
    .split(/\r\n|\r|\n/)
    .map((l) => l.replace(/^[ \t]+|[ \t]+$/g, ''))
    .filter(Boolean)
    .join('\n');

  s = s
    .replace(/<title>[^<>]*<\/title>/, '<title>§</title>')
    .replace(/(<meta name="(?:author|description|copyright)" content=")[^"<>]*(" ?\/>)/g, '$1§$2')
    .replace(/(<(?:html|div)\b[^<>]*? lang=")[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?(")/g, '$1§$2');

  // Trang chạy bài (demo/tutorial/practice/test)
  const container = s.match(/<div id="([A-Za-z0-9_-]{1,32})" class="ap-prez-container"/);
  if (container) {
    s = s
      .replace(`<div id="${container[1]}" class="ap-prez-container"`, '<div id="§" class="ap-prez-container"')
      .replace(`AtomiAP.open("rlprez.js", "${container[1]}"`, 'AtomiAP.open("rlprez.js", "§"');
  }
  s = s
    .replace(/^playMode: "(?:Demo|Tutorial|Practice|Test)",$/m, 'playMode: "§",')
    .replace(/^preloader: \{zIndex: \d+,diameter: \d+,density: \d+,range: \d+,speed: \d+(?:\.\d+)?,color:'#[0-9A-Fa-f]{3,8}',shape:'[a-z]+'\}$/m, 'preloader: §');

  // Trang chủ chọn chế độ (index.html)
  s = s
    .replace(/<h1>[^<>]*<\/h1>/, '<h1>§</h1>')
    .replace(/(<td id="ap-label-(?:description|author|copyright)">[^<>]*<\/td>\n<td>)[^<>]*(<\/td>)/g, '$1§$2')
    .replace(/<a href="(?:https?:\/\/[^"<>\s]*)?" target="_blank">[^<>]*<\/a>/, '<a href="§" target="_blank">§</a>')
    .replace(/^var opmodes = \d{1,3};$/m, 'var opmodes = §;')
    .replace(/^var language = (\{.*\});$/m, (line, json) => {
      try {
        const values = Object.values(JSON.parse(json));
        // Các chuỗi này được gán vào innerHTML nên không được chứa ký tự tạo thẻ
        const safe = values.every((v) => typeof v === 'string' && !/[<>&]/.test(v));
        return safe ? 'var language = §;' : line;
      } catch {
        return line;
      }
    });
  return s;
}

const pageHash = (text) => sha256(Buffer.from(pageSkeleton(text), 'utf8'));

// ─── Phương tiện, CSS, SVG, manifest ───────────────────────────────────────
const startsWith = (b, hex, at = 0) => b.subarray(at, at + hex.length / 2).toString('hex') === hex;
const ascii = (b, str, at = 0) => b.subarray(at, at + str.length).toString('latin1') === str;
const MEDIA_CHECKS = {
  '.png': (b) => startsWith(b, '89504e470d0a1a0a'),
  '.jpg': (b) => startsWith(b, 'ffd8ff'),
  '.jpeg': (b) => startsWith(b, 'ffd8ff'),
  '.gif': (b) => ascii(b, 'GIF87a') || ascii(b, 'GIF89a'),
  '.webp': (b) => ascii(b, 'RIFF') && ascii(b, 'WEBP', 8),
  '.bmp': (b) => ascii(b, 'BM'),
  '.mp3': (b) => ascii(b, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  '.wav': (b) => ascii(b, 'RIFF') && ascii(b, 'WAVE', 8),
  '.ogg': (b) => ascii(b, 'OggS'),
  '.oga': (b) => ascii(b, 'OggS'),
  '.ogv': (b) => ascii(b, 'OggS'),
  '.m4a': (b) => ascii(b, 'ftyp', 4),
  '.m4v': (b) => ascii(b, 'ftyp', 4),
  '.mp4': (b) => ascii(b, 'ftyp', 4),
  '.webm': (b) => startsWith(b, '1a45dfa3'),
  '.woff': (b) => ascii(b, 'wOFF'),
  '.woff2': (b) => ascii(b, 'wOF2'),
  '.ttf': (b) => startsWith(b, '00010000') || ascii(b, 'true'),
  '.otf': (b) => ascii(b, 'OTTO'),
};

function checkSvg(text) {
  if (/<!ENTITY/i.test(text)) return 'SVG khai báo ENTITY';
  const flat = decodeEntities(text);
  if (/<(?:[\w-]+:)?(script|foreignObject|iframe|object|embed|handler)(?=[\s/>])/i.test(text)) return 'SVG chứa thẻ thực thi';
  if (/[\s/"']on[a-z]{3,}\s*=/i.test(text)) return 'SVG chứa thuộc tính sự kiện';
  if (/(javascript|vbscript)\s*:/i.test(flat.replace(/[\t\r\n]/g, ''))) return 'SVG chứa địa chỉ javascript:';
  return null;
}

function checkCss(text) {
  if (text.includes('\\') && /\\[0-9a-f]/i.test(text.replace(/content\s*:\s*(["'])(?:(?!\1).)*\1/gi, ''))) return 'CSS dùng ký tự mã hóa';
  if (/@import|expression\s*\(|javascript\s*:|-moz-binding|behavior\s*:/i.test(text)) return 'CSS chứa lệnh không được phép';
  if (/url\(\s*["']?\s*(?:[a-z]+:)?\/\//i.test(text)) return 'CSS tải tài nguyên từ bên ngoài';
  return null;
}

function checkManifest(text, entryNames, prefix) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return 'imsmanifest.xml khai báo DOCTYPE/ENTITY';
  // Dùng cùng bộ phân tích với bước giải nén để hai bước hiểu giống nhau
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(text);
  const pages = new Set(PAGE_NAMES.map((n) => prefix + n));
  let problem = null;
  (function walk(node) {
    if (problem || !node || typeof node !== 'object') return;
    for (const [key, val] of Object.entries(node)) {
      if (key === '@_xml:base') problem = 'imsmanifest.xml dùng xml:base';
      else if (key === '@_href') {
        let href = String(val);
        try { href = decodeURIComponent(href); } catch { /* giữ nguyên */ }
        if (!entryNames.has(href)) problem = `Gói thiếu tệp mà imsmanifest.xml khai báo: ${String(val).slice(0, 80)}`;
      } else walk(val);
    }
  })(doc);
  if (problem) return problem;
  const resources = [].concat(doc?.manifest?.resources?.resource || []);
  // Trang khởi chạy = resource đầu tiên có href (bước giải nén chọn theo cách này) và mọi resource kiểu "sco".
  // Các resource còn lại chỉ khai báo ảnh, âm thanh, script phụ thuộc.
  const first = resources.find((r) => r && r['@_href']);
  if (!first) return 'imsmanifest.xml không có trang khởi chạy';
  const isSco = (r) => Object.entries(r || {}).some(([k, val]) => /scormtype$/i.test(k) && String(val).toLowerCase() === 'sco');
  const launches = [first, ...resources.filter(isSco)].map((r) => r['@_href']).filter(Boolean);
  if (launches.some((h) => !pages.has(h))) return 'imsmanifest.xml khởi chạy trang không phải của ActivePresenter';
  return null;
}

// Tệp mà trang HTML gọi tới (trình phát, kiểu dáng) — thiếu thì bài không chạy được
function pageReferences(text) {
  return [...text.matchAll(/<(?:script|link)\b[^<>]*?\s(?:src|href)="([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((ref) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref));
}

// ─── Kiểm tra cả gói ───────────────────────────────────────────────────────
function isSafeEntryName(name) {
  const parts = name.replace(/\/$/, '').split('/');
  return parts.every((s) => s !== ''
    && !/[\u0000-\u001f\\:*?"<>|]/.test(s)
    && !/[. ]$/.test(s) // Windows bỏ dấu chấm/cách cuối → trùng tên tệp khác (kể cả "." và "..")
    && !/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(s));
}

/**
 * @param {AdmZip} zip
 * @param {object} trusted  kết quả loadTrusted()
 * @returns {{ok:boolean, format:string|null, prefix:string|null, issues:{file:string,reason:string}[],
 *            files:{path:string, data:Buffer}[]}}  files = các tệp được phép giải nén
 */
function validatePackage(zip, trusted = loadTrusted()) {
  const issues = [];
  const add = (file, reason) => { if (issues.length < MAX_ISSUES) issues.push({ file, reason }); };
  const result = (format = null, prefix = null, files = []) => ({
    ok: issues.length === 0, format, prefix, issues, files: issues.length === 0 ? files : [],
  });

  // 1. Cấu trúc ZIP (chưa giải nén)
  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) { add('(gói)', `Quá nhiều tệp (${entries.length}, tối đa ${MAX_ENTRIES})`); return result(); }
  const seen = new Set();
  let total = 0;
  for (const e of entries) {
    const name = e.entryName;
    if (!isSafeEntryName(name)) add(name, 'Tên hoặc đường dẫn tệp không hợp lệ');
    const key = name.toLowerCase();
    if (seen.has(key)) add(name, 'Trùng tên với tệp khác trong gói');
    seen.add(key);
    if (e.header.flags & 1) add(name, 'Tệp đặt mật khẩu, không kiểm tra được');
    total += e.header.size;
  }
  if (total > MAX_TOTAL_BYTES) add('(gói)', `Giải nén vượt ${Math.round(MAX_TOTAL_BYTES / 1048576)}MB`);
  if (issues.length) return result();

  const files = entries.filter((e) => !e.isDirectory);
  const names = new Set(files.map((e) => e.entryName));

  // 2. Nhận dạng gói
  const dataFiles = [...names].filter((n) => n === 'rlprez.js' || n.endsWith('/rlprez.js'));
  const prefix = dataFiles.length === 1 ? dataFiles[0].slice(0, -'rlprez.js'.length) : null;
  if (prefix === null || !ALLOWED_PREFIXES.includes(prefix)) {
    add('(gói)', 'Không đúng cấu trúc gói ActivePresenter (cần đúng một tệp rlprez.js ở gốc hoặc trong HTML5/). Hãy mở thư mục vừa xuất ra, chọn tất cả bên trong rồi nén');
    return result();
  }
  const format = names.has('imsmanifest.xml') ? 'SCORM' : 'HTML5';
  // Gói HTML5 phải có trang mở bài ngay ở gốc, nếu không đến lúc giải nén mới phát hiện không mở được
  if (format === 'HTML5' && prefix !== '') {
    add('imsmanifest.xml', 'Thiếu imsmanifest.xml (gói SCORM) hoặc nén sai thư mục. Hãy mở thư mục vừa xuất ra, chọn tất cả bên trong rồi nén');
  }
  for (const required of ['player/rlplayer.js', 'rlprez.css']) {
    if (!names.has(prefix + required)) add(prefix + required, 'Gói thiếu tệp này');
  }
  if (!PAGE_NAMES.some((n) => names.has(prefix + n))) add('(gói)', 'Thiếu trang mở bài');

  // 3. Từng tệp
  const accepted = [];
  for (const e of files) {
    const name = e.entryName;
    if (IGNORED_FILES.has(name)) continue;
    let data;
    try {
      data = e.getData();
    } catch {
      add(name, 'Tệp hỏng, không đọc được');
      continue;
    }
    if (data.length !== e.header.size) { add(name, 'Dung lượng thật khác dung lượng khai báo'); continue; }

    const rel = name.startsWith(prefix) ? name.slice(prefix.length) : null;
    const ext = path.posix.extname(name).toLowerCase();
    const isText = () => {
      const text = decodeText(data);
      if (text === null) add(name, 'Tệp văn bản không phải UTF-8 hợp lệ');
      return text;
    };
    const report = (reason) => { if (reason) add(name, reason); };

    if (rel && rel.startsWith('player/')) {
      const known = trusted.player[rel];
      if (!known) add(name, 'Tệp lạ trong trình phát');
      else if (!known.includes(sha256(data))) add(name, 'Tệp trình phát đã bị sửa hoặc thuộc phiên bản chưa được tin cậy');
    } else if (Object.hasOwn(trusted.schemas, name)) { // tránh trùng tên thuộc tính sẵn có như "constructor"
      if (!trusted.schemas[name].includes(sha256(data))) add(name, 'Lược đồ SCORM đã bị sửa');
    } else if (rel === 'rlprez.js') {
      const text = isText();
      if (text !== null) {
        try {
          checkDataScript(text);
        } catch (err) {
          if (!(err instanceof DataScriptError)) throw err;
          add(name, err.message);
        }
      }
    } else if (rel === 'rlprez.css') {
      const text = isText();
      if (text !== null) report(checkCss(text));
    } else if (rel && PAGE_NAMES.includes(rel)) {
      const text = isText();
      if (text !== null) {
        if (!trusted.pages.includes(pageHash(text))) {
          add(name, 'Trang HTML khác khuôn ActivePresenter đã tin cậy (có thể bị chèn mã)');
        } else {
          for (const ref of pageReferences(text)) {
            if (!names.has(prefix + ref)) add(prefix + ref, `Gói thiếu tệp mà ${rel} cần dùng`);
          }
        }
      }
    } else if (rel && rel.startsWith('resources/')) {
      if (ext === '.svg') {
        const text = isText();
        if (text !== null) report(checkSvg(text));
      } else if (ext === '.vtt') {
        const text = isText();
        if (text !== null && !text.startsWith('WEBVTT')) add(name, 'Nội dung không khớp đuôi tệp');
      } else if (!MEDIA_CHECKS[ext]) {
        add(name, 'Loại tệp không được phép');
      } else if (!MEDIA_CHECKS[ext](data)) {
        add(name, 'Nội dung không khớp đuôi tệp');
      }
    } else if (name === 'imsmanifest.xml') {
      const text = isText();
      if (text !== null) {
        try {
          report(checkManifest(text, names, prefix));
        } catch {
          add(name, 'Không đọc được imsmanifest.xml');
        }
      }
    } else {
      add(name, 'Tệp không thuộc cấu trúc gói ActivePresenter');
    }
    accepted.push({ path: name, data });
  }
  return result(format, prefix, accepted);
}

/** Ghi các tệp ĐÃ QUA KIỂM TRA ra thư mục bài giảng (đúng dữ liệu vừa kiểm tra, không đọc lại ZIP) */
function writePackage(files, targetDir) {
  const root = path.resolve(targetDir);
  for (const f of files) {
    const dest = path.resolve(root, ...f.path.split('/'));
    if (!dest.startsWith(root + path.sep)) throw new Error(`Đường dẫn vượt ra ngoài thư mục bài giảng: ${f.path}`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.data);
  }
}

function formatIssues(issues, limit = 5) {
  const lines = issues.slice(0, limit).map((i) => `${i.file}: ${i.reason}`);
  const more = issues.length > limit ? ` (và ${issues.length - limit} lỗi khác)` : '';
  return `Gói bài giảng bị từ chối — ${lines.join('; ')}${more}`;
}

module.exports = {
  TRUSTED_FILE,
  PAGE_NAMES,
  loadTrusted,
  validatePackage,
  writePackage,
  formatIssues,
  checkDataScript,
  pageHash,
  sha256,
};
