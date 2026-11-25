/**
 * API SCORM cho chế độ XEM TRƯỚC ("Đọc bài giảng").
 *
 * Gói SCORM/HTML5 tìm window.API (SCORM 1.2) hoặc window.API_1484_11 (SCORM 2004) ở cửa sổ cha;
 * không thấy thì liên tục hiện hộp thoại "Unable to locate the LMS's API Implementation".
 * Ở chế độ xem trước, API này chỉ giữ giá trị trong bộ nhớ — KHÔNG ghi tiến độ hay kết quả nào.
 * Chế độ mở ca dạy dùng API riêng trong LiveSessionRoom.
 */
export function installPreviewScormApi(): () => void {
  const data: Record<string, string> = {};
  const ok = () => 'true';
  const noError = () => '0';
  const empty = () => '';
  const get = (key: string) => data[key] || '';
  const set = (key: string, value: string) => {
    data[key] = String(value);
    return 'true';
  };

  const api12 = {
    LMSInitialize: ok,
    LMSFinish: ok,
    LMSGetValue: get,
    LMSSetValue: set,
    LMSCommit: ok,
    LMSGetLastError: noError,
    LMSGetErrorString: empty,
    LMSGetDiagnostic: empty,
  };
  const api2004 = {
    Initialize: ok,
    Terminate: ok,
    GetValue: get,
    SetValue: set,
    Commit: ok,
    GetLastError: noError,
    GetErrorString: empty,
    GetDiagnostic: empty,
  };

  const w = window as any;
  w.API = api12;
  w.API_1484_11 = api2004;

  return () => {
    // Chỉ gỡ API của mình, không đụng API của phòng dạy nếu đã được thay
    if (w.API === api12) delete w.API;
    if (w.API_1484_11 === api2004) delete w.API_1484_11;
  };
}
