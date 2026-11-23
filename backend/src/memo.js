// backend/src/memo.js
// Bộ nhớ đệm TTL ngắn + gộp request đang chạy (single-flight).
// Mục đích: các truy vấn "tra cứu" lặp lại ở MỌI request (vai trò, đơn vị, cây đơn vị...) chỉ chạy
// 1 lần / TTL cho mỗi khóa, và khi nhiều request cùng hỏi một khóa lúc cache nguội thì chỉ 1 truy vấn thật.
// Đánh đổi: thay đổi vai trò/đơn vị có hiệu lực chậm tối đa TTL (mặc định 15 giây).
// Dùng bộ nhớ của tiến trình → nếu chạy nhiều tiến trình (cluster) mỗi tiến trình có cache riêng.

const store = new Map();   // key → { value, exp }
const inflight = new Map(); // key → Promise
const MAX_ENTRIES = 5000;

async function memo(key, ttlMs, loader) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) return hit.value;

  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const value = await loader();
      if (store.size >= MAX_ENTRIES) {
        // dọn mục hết hạn; nếu vẫn đầy thì bỏ mục cũ nhất
        for (const [k, v] of store) if (v.exp <= now) store.delete(k);
        if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
      }
      store.set(key, { value, exp: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// Xóa cache theo tiền tố (gọi khi biết chắc dữ liệu vừa đổi; không bắt buộc)
function invalidate(prefix = '') {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

module.exports = { memo, invalidate };
