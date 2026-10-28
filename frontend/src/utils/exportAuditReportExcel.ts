import ExcelJS from 'exceljs';
import { AccessLog } from '../types/user';
import { extractTargets, getActionCategory } from '../components/dashboard/SecurityAuditLog';

/**
 * Xuất file báo cáo Nhật ký kiểm toán an ninh dạng Excel (.xlsx)
 * Chuẩn định dạng Quân đội theo mẫu: "Xuất báo cáo mẫu.xlsx"
 * 
 * Cấu trúc:
 * - A1:D1: PHÒNG THAM MƯU HÀNH CHÍNH | E1:I1: CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
 * - A2:D2: TỔ CÔNG NGHỆ THÔNG TIN   | E2:I2: Độc lập - Tự do - Hạnh phúc
 * - A3:D3: Số: ……/BC-CNTT           | E3:I3: Thành phố Hồ Chí Minh, ngày ... tháng ... năm ...
 * - A5:I5: NHẬT KÝ HOẠT ĐỘNG - DỮ LIỆU SỐ (Tiêu đề lớn)
 * - Row 6: Tiêu đề các cột (Nền cam vàng #FFC000, viền mảnh, căn giữa)
 * - Row 7+: Dữ liệu nhật ký
 * - Footer: NGƯỜI LẬP -> Thiếu tá QNCN Nguyễn Mạnh Nam
/**
 * Chuẩn bị file báo cáo Nhật ký kiểm toán an ninh dạng Excel (.xlsx)
 * Chuẩn định dạng Quân đội theo mẫu: "Xuất báo cáo mẫu.xlsx"
 * Trả về hàm release() để chỉ thả file về máy khi UI/UX hoàn tất.
 */
export async function prepareAuditReportExcel(logs: AccessLog[]): Promise<() => void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QK7 DataHub';
  workbook.lastModifiedBy = 'Thiếu tá QNCN Nguyễn Mạnh Nam';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Nhật Ký Hoạt Động', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
    views: [{ showGridLines: true }],
  });

  // Thiết lập độ rộng các cột khớp với mẫu
  worksheet.columns = [
    { key: 'log_id', width: 28 },         // Cột A: Mã Log
    { key: 'time', width: 22 },           // Cột B: Thời Gian
    { key: 'user_id', width: 18 },        // Cột C: Mã Quân Nhân
    { key: 'full_name', width: 26 },      // Cột D: Họ Tên Quân Nhân
    { key: 'action', width: 18 },         // Cột E: Hành Động
    { key: 'category', width: 20 },       // Cột F: Nhóm Phân Loại
    { key: 'target', width: 42 },         // Cột G: Đối Tượng / Văn Bản
    { key: 'ip', width: 18 },             // Cột H: Địa Chỉ IP
    { key: 'note', width: 36 },           // Cột I: Ghi Chú
  ];

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();

  // ─── ROW 1 ───
  worksheet.mergeCells('A1:D1');
  const cellA1 = worksheet.getCell('A1');
  cellA1.value = 'PHÒNG THAM MƯU HÀNH CHÍNH';
  cellA1.font = { name: 'Times New Roman', size: 13, bold: true };
  cellA1.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('E1:I1');
  const cellE1 = worksheet.getCell('E1');
  cellE1.value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
  cellE1.font = { name: 'Times New Roman', size: 13, bold: true };
  cellE1.alignment = { horizontal: 'center', vertical: 'middle' };

  // ─── ROW 2 ───
  worksheet.mergeCells('A2:D2');
  const cellA2 = worksheet.getCell('A2');
  cellA2.value = 'TỔ CÔNG NGHỆ THÔNG TIN';
  cellA2.font = { name: 'Times New Roman', size: 13, bold: true, underline: true };
  cellA2.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('E2:I2');
  const cellE2 = worksheet.getCell('E2');
  cellE2.value = 'Độc lập - Tự do - Hạnh phúc';
  cellE2.font = { name: 'Times New Roman', size: 13, bold: true, underline: true };
  cellE2.alignment = { horizontal: 'center', vertical: 'middle' };

  // ─── ROW 3 ───
  worksheet.mergeCells('A3:D3');
  const cellA3 = worksheet.getCell('A3');
  cellA3.value = 'Số: ……/BC-CNTT';
  cellA3.font = { name: 'Times New Roman', size: 13, italic: false };
  cellA3.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('E3:I3');
  const cellE3 = worksheet.getCell('E3');
  cellE3.value = `Thành phố Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}`;
  cellE3.font = { name: 'Times New Roman', size: 13, italic: true };
  cellE3.alignment = { horizontal: 'right', vertical: 'middle' };

  // ─── ROW 4: DÒNG TRỐNG ───
  worksheet.getRow(4).height = 14;

  // ─── ROW 5: TIÊU ĐỀ BÁO CÁO ───
  worksheet.mergeCells('A5:I5');
  const cellA5 = worksheet.getCell('A5');
  cellA5.value = 'NHẬT KÝ HOẠT ĐỘNG - DỮ LIỆU SỐ';
  cellA5.font = { name: 'Times New Roman', size: 14, bold: true };
  cellA5.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(5).height = 28;

  // ─── ROW 6: TIÊU ĐỀ CÁC CỘT (HEADER) ───
  const headers = [
    'Mã Log',
    'Thời Gian',
    'Mã Quân Nhân',
    'Họ Tên Quân Nhân',
    'Hành Động',
    'Nhóm Phân Loại',
    'Đối Tượng / Văn Bản',
    'Địa Chỉ IP',
    'Ghi Chú',
  ];

  const headerRow = worksheet.getRow(6);
  headerRow.height = 28;

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  headers.forEach((h, colIndex) => {
    const cell = headerRow.getCell(colIndex + 1);
    cell.value = h;
    cell.font = { name: 'Times New Roman', size: 13, bold: true, color: { argb: 'FF000000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC000' }, // Nền cam vàng theo đúng mẫu Excel
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  // ─── ROW 7+: DỮ LIỆU NHẬT KÝ ───
  let currentRowIdx = 7;

  logs.forEach((l) => {
    const row = worksheet.getRow(currentRowIdx);
    row.height = 24;

    // Trích xuất đối tượng
    const targets = extractTargets(l);
    const targetStr =
      targets.map((t) => (t.name ? `${t.name} (${t.id})` : t.id)).join('; ') || '—';

    // Thời gian định dạng dd/mm/yyyy hh:mm:ss
    const rawTime = l.created_at || l.timestamp;
    let timeStr = '—';
    if (rawTime) {
      const d = new Date(rawTime);
      if (!isNaN(d.getTime())) {
        const dStr = String(d.getDate()).padStart(2, '0');
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const yStr = d.getFullYear();
        const hStr = String(d.getHours()).padStart(2, '0');
        const minStr = String(d.getMinutes()).padStart(2, '0');
        const sStr = String(d.getSeconds()).padStart(2, '0');
        timeStr = `${dStr}/${mStr}/${yStr} ${hStr}:${minStr}:${sStr}`;
      }
    }

    const category = getActionCategory(l.action, l.note);

    const values = [
      l.log_id || '—',
      timeStr,
      l.user_id || '—',
      l.full_name || 'Hệ thống',
      (l.action || '—').toUpperCase(),
      category,
      targetStr,
      l.ip || '—',
      l.note || '',
    ];

    values.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.font = { name: 'Times New Roman', size: 12 };
      cell.border = thinBorder;

      // Căn chỉnh vị trí từng cột
      if (colIdx === 0 || colIdx === 1 || colIdx === 2 || colIdx === 4 || colIdx === 5 || colIdx === 7) {
        // Mã log, Thời gian, Mã QN, Hành động, Phân loại, IP -> Center
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        // Tên quân nhân, Đối tượng, Ghi chú -> Left
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }

      // Tô màu nhẹ nếu là sự kiện cảnh báo lỗi
      if (category === 'ALERT') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF0F0' }, // Nền hồng nhạt
        };
      }
    });

    currentRowIdx++;
  });

  // ─── FOOTER: CHỮ KÝ NGƯỜI LẬP ───
  // Dòng trống cách bảng
  currentRowIdx += 1;

  // Dòng "NGƯỜI LẬP"
  const signerTitleRowIdx = currentRowIdx + 1;
  worksheet.mergeCells(`H${signerTitleRowIdx}:I${signerTitleRowIdx}`);
  const cellSignerTitle = worksheet.getCell(`H${signerTitleRowIdx}`);
  cellSignerTitle.value = 'NGƯỜI LẬP';
  cellSignerTitle.font = { name: 'Times New Roman', size: 13, bold: true };
  cellSignerTitle.alignment = { horizontal: 'center', vertical: 'middle' };

  // Dòng chữ ký "Thiếu tá QNCN Nguyễn Mạnh Nam" (cách 3 dòng trống)
  const signerNameRowIdx = signerTitleRowIdx + 4;
  worksheet.mergeCells(`H${signerNameRowIdx}:I${signerNameRowIdx}`);
  const cellSignerName = worksheet.getCell(`H${signerNameRowIdx}`);
  cellSignerName.value = 'Thiếu tá QNCN Nguyễn Mạnh Nam';
  cellSignerName.font = { name: 'Times New Roman', size: 13, bold: true };
  cellSignerName.alignment = { horizontal: 'center', vertical: 'middle' };

  // Ghi buffer và chuẩn bị hàm release tệp Excel
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileDateStr = `${year}${month}${day}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    a.download = `Nhat_Ky_Hoat_Dong_Thu_Vien_So_${fileDateStr}.xlsx`;
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  };
}

/**
 * Xuất file báo cáo Nhật ký kiểm toán an ninh dạng Excel (.xlsx) trực tiếp
 */
export async function exportAuditReportExcel(logs: AccessLog[]): Promise<void> {
  const release = await prepareAuditReportExcel(logs);
  release();
}
