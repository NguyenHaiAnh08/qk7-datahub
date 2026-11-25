// Kiểm thử bộ lọc gói bài giảng bằng gói giả lập (không cần tệp mẫu, không cần CSDL)
//   node --test test-lecture-package.js
const test = require('node:test');
const assert = require('node:assert');
const AdmZip = require('adm-zip');
const v = require('./src/lecture-package-validator');

const PLAYER = 'var AtomiAP = {};';
const PAGE = `<!DOCTYPE html>
<html lang="vi-VN" dir="ltr">
<head>
<title>Bài mẫu</title>
<script type="text/javascript" src="player/rlplayer.js"></script>
</head>
<body>
<div id="abc123" class="ap-prez-container" lang="vi-VN" dir="ltr">
<script type="text/javascript">
AtomiAP.open("rlprez.js", "abc123", {
playMode: "Tutorial",
preloader: {zIndex: 2,diameter: 60,density: 9,range: 1000,speed: 1,color:'#2090E6',shape:'oval'}
});
</script>
</div>
</body>
</html>`;
const DATA = `/*! mau */
(function(AP) {
  var $, jQuery;
  $ = jQuery = AP.$;
  var d = {params:{size:[1,-2.5],on:true,none:null},toc:{l:"<p style=\\"color:red\\">Xin chào</p>"}},
  f = [];
  d.f = f;
  d.playbackRates = [ 0.5, 1.0 ];
  AP.loadedPrezs.push(d);
})(AtomiAP);
// ghi chú`;

const trusted = {
  player: { 'player/rlplayer.js': [v.sha256(Buffer.from(PLAYER))] },
  schemas: {},
  pages: [v.pageHash(PAGE)],
};

function check(changes = {}) {
  const files = {
    'player/rlplayer.js': PLAYER,
    'tutorial.html': PAGE,
    'rlprez.js': DATA,
    'rlprez.css': '.a{color:red}',
    'resources/a.png': Buffer.from('89504e470d0a1a0a0000', 'hex'),
    ...changes,
  };
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    if (content !== null) zip.addFile(name, Buffer.from(content));
  }
  return v.validatePackage(zip, trusted);
}

test('gói đúng cấu trúc được chấp nhận', () => {
  const r = check();
  assert.deepStrictEqual(r.issues, []);
  assert.strictEqual(r.format, 'HTML5');
  assert.strictEqual(r.files.length, 5);
});

test('đổi tiêu đề, mã khung, chế độ vẫn được chấp nhận', () => {
  const page = PAGE.replace('Bài mẫu', 'Bài khác').split('abc123').join('Zz-9_x').replace('"Tutorial"', '"Demo"');
  assert.ok(check({ 'tutorial.html': page }).ok);
});

const rejected = {
  'thêm tệp script': { 'resources/x.js': 'alert(1)' },
  'thêm tệp ở gốc': { 'x.html': '<p>x</p>' },
  'chương trình đổi đuôi ảnh': { 'resources/b.png': 'MZ....' },
  'sửa trình phát': { 'player/rlplayer.js': `${PLAYER}alert(1)` },
  'thiếu trình phát': { 'player/rlplayer.js': null },
  'thiếu kiểu dáng bài': { 'rlprez.css': null },
  'trang bị chèn script': { 'tutorial.html': PAGE.replace('</body>', '<script>alert(1)</script></body>') },
  'trang bị thêm sự kiện': { 'tutorial.html': PAGE.replace('<body>', '<body onload="alert(1)">') },
  'dữ liệu có lời gọi hàm': { 'rlprez.js': DATA.replace('d.f = f;', 'd.f = f; alert(1);') },
  'hành động JavaScript trong mảng f': { 'rlprez.js': DATA.replace('f = [];', 'f = [function(){}];') },
  'mã sau phần dữ liệu': { 'rlprez.js': `${DATA}\nalert(1);` },
  'mã nấp sau dấu xuống dòng U+2028': { 'rlprez.js': DATA.replace('// ghi chú', '// x\u2028alert(1)') },
  'chuỗi có sự kiện HTML': { 'rlprez.js': DATA.replace('Xin chào', '<img src=x onerror=alert(1)>') },
  'chuỗi có địa chỉ javascript': { 'rlprez.js': DATA.replace('Xin chào', "<a href='javascript:alert(1)'>a</a>") },
  'SVG có script': { 'resources/c.svg': '<svg><script>alert(1)</script></svg>' },
  'tên tệp trùng thuộc tính đối tượng': { constructor: 'x' },
  'hai tệp trùng tên khác hoa thường': { 'Player/rlplayer.js': 'x' },
};
for (const [label, changes] of Object.entries(rejected)) {
  test(`từ chối: ${label}`, () => {
    const r = check(changes);
    assert.strictEqual(r.ok, false, JSON.stringify(r.issues));
    assert.strictEqual(r.files.length, 0, 'gói không đạt thì không trả tệp nào để giải nén');
  });
}

test('thiếu tệp mà trang cần dùng bị từ chối', () => {
  const page = PAGE.replace('<title>', '<link rel="stylesheet" href="player/rlplayer.css" /><title>');
  const css = '.b{}';
  const t = { ...trusted, player: { ...trusted.player, 'player/rlplayer.css': [v.sha256(Buffer.from(css))] }, pages: [v.pageHash(page)] };
  const zip = new AdmZip();
  for (const [n, c] of Object.entries({ 'player/rlplayer.js': PLAYER, 'tutorial.html': page, 'rlprez.js': DATA, 'rlprez.css': '.a{}' })) zip.addFile(n, Buffer.from(c));
  const r = v.validatePackage(zip, t);
  assert.deepStrictEqual(r.issues.map((i) => i.file), ['player/rlplayer.css']);
  zip.addFile('player/rlplayer.css', Buffer.from(css));
  assert.deepStrictEqual(v.validatePackage(zip, t).issues, []);
});

test('gói chỉ có thư mục HTML5, thiếu imsmanifest.xml bị từ chối', () => {
  const zip = new AdmZip();
  for (const [n, c] of Object.entries({ 'player/rlplayer.js': PLAYER, 'tutorial.html': PAGE, 'rlprez.js': DATA, 'rlprez.css': '.a{}' })) zip.addFile(`HTML5/${n}`, Buffer.from(c));
  const t = { ...trusted, player: { 'player/rlplayer.js': trusted.player['player/rlplayer.js'] } };
  const r = v.validatePackage(zip, t);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(r.issues.map((i) => i.file), ['imsmanifest.xml']);
});

test('gói không phải ActivePresenter bị từ chối', () => {
  const zip = new AdmZip();
  zip.addFile('index.html', Buffer.from('<p>x</p>'));
  assert.strictEqual(v.validatePackage(zip, trusted).ok, false);
});
