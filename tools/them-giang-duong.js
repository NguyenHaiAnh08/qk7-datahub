/**
 * THÊM HÀNG LOẠT GIẢNG ĐƯỜNG  GD-A6 … GD-A99
 *
 * CÁCH DÙNG
 *  1. Đăng nhập web bằng tài khoản Admin.
 *  2. Mở trang bất kỳ của web, nhấn F12 -> tab Console.
 *  3. (Chrome lần đầu) gõ:  allow pasting   rồi Enter.
 *  4. Dán toàn bộ file này, Enter. Mặc định chỉ CHẠY THỬ (không ghi gì).
 *  5. Thấy kết quả chạy thử ổn thì gõ:   themGiangDuong({ thatSu: true })
 *
 * Mỗi phòng gọi đúng API mà nút "Lưu lại" của form dùng
 * (POST /api/admin/lectures/classrooms) nên vẫn kiểm tra quyền + ghi nhật ký.
 * Phòng đã tồn tại (409) được bỏ qua, chạy lại nhiều lần vẫn an toàn.
 */
async function themGiangDuong(opt = {}) {
  const cfg = Object.assign({
    tu: 6,                 // A6
    den: 99,               // A99
    tienTo: 'A',
    maKhu: 'H1',           // "Khu A" trong danh mục khu
    loaiPhong: 'LECTURE_HALL', // Giảng đường
    sucChua: 70,
    ghiChu: 'Bình thường',
    doTreMs: 250,          // nghỉ giữa các lần gọi, tránh bị giới hạn tốc độ
    thatSu: false,         // false = chạy thử
  }, opt);

  const token = sessionStorage.getItem('qk7_token');
  if (!token) { console.error('Chưa đăng nhập (không thấy qk7_token). Đăng nhập Admin rồi chạy lại.'); return; }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const kq = { them: [], daCo: [], loi: [], choDuyet: [] };

  for (let n = cfg.tu; n <= cfg.den; n++) {
    const body = {
      room_id: `GD-${cfg.tienTo}${n}`,
      room_name: `Giảng đường ${cfg.tienTo}${n}`,
      building_code: cfg.maKhu,
      room_type: cfg.loaiPhong,
      capacity: cfg.sucChua,
      description: cfg.ghiChu,
    };
    if (!cfg.thatSu) { console.log('[CHẠY THỬ]', JSON.stringify(body)); continue; }

    let thuLai = 0;
    while (true) {
      const res = await fetch('/api/admin/lectures/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.status === 429 && thuLai < 5) { thuLai++; await sleep(2000 * thuLai); continue; }
      const data = await res.json().catch(() => ({}));
      if (res.status === 202) kq.choDuyet.push(body.room_id);
      else if (res.status === 409) kq.daCo.push(body.room_id);
      else if (res.ok) kq.them.push(body.room_id);
      else kq.loi.push(`${body.room_id}: ${res.status} ${data.error || ''}`);
      console.log(res.ok ? '✔' : '✘', body.room_id, res.status, data.error || '');
      break;
    }
    await sleep(cfg.doTreMs);
  }

  if (!cfg.thatSu) {
    console.log(`Chạy thử xong: sẽ tạo ${cfg.den - cfg.tu + 1} phòng. Chạy thật: themGiangDuong({ thatSu: true })`);
    return;
  }
  console.log(`XONG: thêm ${kq.them.length}, đã có ${kq.daCo.length}, chờ duyệt ${kq.choDuyet.length}, lỗi ${kq.loi.length}`);
  if (kq.loi.length) console.log('Lỗi:', kq.loi);
  return kq;
}
themGiangDuong(); // mặc định: chạy thử
