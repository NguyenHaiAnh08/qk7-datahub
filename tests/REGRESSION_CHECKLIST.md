# CHECKLIST REGRESSION TEST BẢO MẬT & NGHIỆP VỤ — QK7 DATAHUB
## (Sau khi áp dụng các bản vá bảo mật OWASP Top 10, CWE & Nâng cấp SCA)

---

**Phiên bản kiểm thử:** QK7 DataHub v5.2 (Secure Release)  
**Môi trường:** Máy trạm PC / Laptop + Cảm biến ZKTeco ZK9500 + Trình duyệt Chrome/Edge  
**Ngày lập:** 11/11/2026  
**Người kiểm thử:** Kỹ sư Đảm bảo chất lượng (QA) / Kỹ sư DevSecOps / Người quản trị

---

### MỤC A: XÁC THỰC 2FA KÉP (VÂN TAY ZK9500 + MÃ PIN 6 SỐ)
| STT | Kịch bản kiểm thử | Thao tác thực hiện | Kết quả mong đợi | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| A.1 | Mở tài liệu Cấp 3 (Mật) | Đăng nhập tài khoản có clearance $\ge 3$, nhấn "Xem tài liệu Cấp 3" | Modal yêu cầu quét vân tay ZK9500 hiển thị; đèn cảm biến nhấp nháy xanh | *(Chờ test)* | [ ] |
| A.2 | Quét vân tay hợp lệ (Cấp 3) | Đặt ngón tay đã đăng ký lên đầu đọc ZK9500 | Thiết bị đối sánh thành công, hệ thống cấp `fingerprint_token` (5 phút) và hiển thị tài liệu PDF | *(Chờ test)* | [ ] |
| A.3 | Yêu cầu nhập PIN cho Cấp 4-5 | Mở tài liệu Cấp 4 (Tối mật) hoặc Cấp 5 (Tuyệt mật) $\rightarrow$ Quét vân tay thành công | Hệ thống hiển thị thêm bước yêu cầu nhập mã PIN 6 số | *(Chờ test)* | [ ] |
| A.4 | Nhập PIN đúng | Nhập đúng mã PIN 6 số đã đăng ký | Mở thành công tài liệu PDF Cấp 4/5 | *(Chờ test)* | [ ] |
| A.5 | Nhập sai PIN 3 lần | Nhập sai mã PIN 3 lần liên tiếp | Bị khóa tạm thời hoặc từ chối truy cập; ghi log `DENIED` | *(Chờ test)* | [ ] |
| A.6 | Quét vân tay sai 3 lần | Sử dụng ngón tay chưa đăng ký quét 3 lần | Từ chối truy cập, thông báo "Vân tay không khớp" | *(Chờ test)* | [ ] |
| A.7 | Hết hạn token 5 phút | Giữ tab xem tài liệu quá 5 phút rồi tải lại trang | `fingerprint_token` hết hạn, hệ thống bắt buộc quét lại vân tay | *(Chờ test)* | [ ] |

---

### MỤC B: WATERMARK ĐỘNG THỜI GIAN THỰC
| STT | Kịch bản kiểm thử | Thao tác thực hiện | Kết quả mong đợi | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| B.1 | Hiển thị thông tin định danh | Mở tài liệu bất kỳ từ Cấp 2 trở lên | Watermark hiển thị rõ: Họ tên, Số hiệu/CCCD, Tên đơn vị, Địa chỉ IP, Thời gian | *(Chờ test)* | [ ] |
| B.2 | Độ phủ các trang PDF | Cuộn qua trang 1, 2, 3 và trang cuối cùng | Watermark xuất hiện đồng đều trên tất cả các trang | *(Chờ test)* | [ ] |
| B.3 | Không che khuất nội dung | Đọc các đoạn văn bản có chữ phía dưới watermark | Watermark có độ trong suốt (opacity ~0.15 - 0.2), góc nghiêng 30-45 độ, văn bản đọc rõ ràng | *(Chờ test)* | [ ] |
| B.4 | Thời gian chuẩn server | Đối chiếu giờ hiển thị trên watermark với đồng hồ hệ thống máy chủ | Giờ trên watermark khớp với giờ Server (Clock Authority), không lấy theo giờ chỉnh sai của máy client | *(Chờ test)* | [ ] |

---

### MỤC C: BẢO VỆ CHỐNG CHỤP MÀN HÌNH ĐA TẦNG
| STT | Kịch bản kiểm thử | Thao tác thực hiện | Kết quả mong đợi | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| C.1 | Phím PrintScreen | Nhấn phím `PrintScreen` (hoặc `PrtScn`) khi đang xem tài liệu | Màn hình hiển thị cảnh báo vi phạm; clipboard bị làm sạch hoặc nội dung che đen | *(Chờ test)* | [ ] |
| C.2 | Windows Snipping Tool | Nhấn tổ hợp phím `Win + Shift + S` | Kích hoạt bộ phát hiện mất focus / chụp ảnh; hiển thị cảnh báo đỏ | *(Chờ test)* | [ ] |
| C.3 | Phím tắt Zalo / Ứng dụng ngoài | Nhấn `Ctrl + Alt + S` (Zalo Screen Capture) | Cảnh báo vi phạm chụp màn hình xuất hiện | *(Chờ test)* | [ ] |
| C.4 | Chặn Paste lạ | Nhấn `Ctrl + V` vào khung tài liệu | Bị chặn thao tác, không dán được nội dung trái phép | *(Chờ test)* | [ ] |
| C.5 | Khóa tài khoản sau 3 lần vi phạm | Cố tình nhấn PrintScreen 3 lần liên tiếp | Hệ thống khóa phiên làm việc, buộc đăng xuất | *(Chờ test)* | [ ] |
| C.6 | Ghi nhận Audit Log | Mở trang Nhật ký hệ thống (Admin) | Xuất hiện bản ghi `SCREENSHOT_ATTEMPT` với mức độ `CRITICAL/WARNING` | *(Chờ test)* | [ ] |

---

### MỤC D: PHÂN QUYỀN 3 TẦNG (DEFENSE-IN-DEPTH)
| STT | Kịch bản kiểm thử | Thao tác thực hiện | Kết quả mong đợi | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| D.1 | UI Guard (Tầng 1) | Đăng nhập tài khoản Cấp 1 (Công khai) / Delegate | Không hiển thị menu "Quản trị", nút "Tải lên" bị ẩn | *(Chờ test)* | [ ] |
| D.2 | UI Direct URL | Gõ thẳng URL `http://localhost:8000/admin` trên trình duyệt | Bị chuyển hướng về `/portal` hoặc trang 403 Forbidden | *(Chờ test)* | [ ] |
| D.3 | Gateway Middleware (Tầng 2) | Dùng Postman/cURL gọi `GET /api/admin/users` với token User Cấp 2 | Gateway trả về mã lỗi HTTP `403 Forbidden` | *(Chờ test)* | [ ] |
| D.4 | Vượt cấp độ mật | Tài khoản Cấp 2 gọi `GET /api/files/:fileId/view` của file Cấp 3 | Gateway chặn ngay lập tức với mã lỗi `403 Forbidden` (Độ mật vượt clearance) | *(Chờ test)* | [ ] |
| D.5 | SQL Server Constraint (Tầng 3) | Giả lập câu lệnh UPDATE trực tiếp đổi clearance của user vượt mức tối đa | Ràng buộc CHECK Constraint trên DB từ chối giao dịch | *(Chờ test)* | [ ] |
| D.6 | Phạm vi Đơn vị (Unit Scope) | User đơn vị Khoa A tìm kiếm tài liệu nội bộ của Khoa B | Hệ thống không trả về tài liệu của Khoa B (đúng cây đơn vị) | *(Chờ test)* | [ ] |

---

### MỤC E: NHẬT KÝ KIỂM TOÁN (ACCESS_LOG)
| STT | Kịch bản kiểm thử | Thao tác thực hiện | Kết quả mong đợi | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| E.1 | Đăng nhập hệ thống | Đăng nhập thành công và đăng nhập sai mật khẩu | Ghi nhận action `LOGIN` (thành công) và `LOGIN_FAILED` kèm IP | *(Chờ test)* | [ ] |
| E.2 | Xem tài liệu PDF | Mở xem tài liệu thành công | Ghi nhận action `VIEW` kèm `file_id` và tên người xem | *(Chờ test)* | [ ] |
| E.3 | Tải tài liệu | Nhấn nút Tải tài liệu Cấp 1-2 | Ghi nhận action `DOWNLOAD` | *(Chờ test)* | [ ] |
| E.4 | Thao tác Quản trị | Thêm mới hoặc phân quyền User | Ghi nhận log quản trị viên tương ứng | *(Chờ test)* | [ ] |

---

### MỤC F: UPLOAD TẬP TIN & KIỂM TRA MAGIC BYTES (%PDF-)
| STT | Kịch bản kiểm thử | Thao tác thực hiện | Kết quả mong đợi | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| F.1 | Upload PDF hợp lệ | Chọn file PDF thông thường có chữ ký `%PDF-` | Upload và trích xuất thành công | *(Chờ test)* | [ ] |
| F.2 | Đổi đuôi file độc hại (Fake PDF) | Tạo file `malicious.txt` hoặc script JS, đổi tên thành `test.pdf` rồi upload | Bị từ chối với mã lỗi `400 INVALID_FILE_SIGNATURE` (Magic Bytes check) | *(Chờ test)* | [ ] |
| F.3 | Tên file chứa Path Traversal | Upload file có tên `../../etc_passwd.pdf` | Bị từ chối ngay tại `multer.fileFilter` | *(Chờ test)* | [ ] |
| F.4 | Tên file chứa Null Byte | Upload file có tên `test\0.pdf` | Bị từ chối ngay lập tức | *(Chờ test)* | [ ] |
| F.5 | Giới hạn dung lượng 50MB | Upload file lớn hơn 50MB | Bị từ chối với lỗi `LIMIT_FILE_SIZE` | *(Chờ test)* | [ ] |

---

### MỤC G: BẢO VỆ CONTENT SECURITY POLICY (CSP) MỚI
| STT | Kịch bản kiểm thử | Thao tác thực hiện | Kết quả mong đợi | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| G.1 | Kiểm tra Console trình duyệt | Mở F12 Console khi tải trang chủ | Không có lỗi đỏ vi phạm CSP (`Refused to load...`) | *(Chờ test)* | [ ] |
| G.2 | Hiển thị Font & Icon | Kiểm tra font chữ tiếng Việt và icon Ant Design | Hiển thị sắc nét, icon tải bình thường (hỗ trợ `data:`) | *(Chờ test)* | [ ] |
| G.3 | Kết nối WebSocket nội bộ | Mở F12 Network tab $\rightarrow$ WS | Kết nối tới `/ws/fingerprint` thành công (hỗ trợ `ws:`, `wss:`) | *(Chờ test)* | [ ] |
| G.4 | Chống Clickjacking | Thử nhúng trang QK7 DataHub vào iframe domain khác | Trình duyệt chặn nhúng (X-Frame-Options / frame-ancestors 'self') | *(Chờ test)* | [ ] |

---

### MỤC H: TRÌNH ĐỌC PDF (PDF.JS 4.X MỚI)
| STT | Kịch bản kiểm thử | Thao tác thực hiện | Kết quả mong đợi | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| H.1 | Văn bản ngắn 1 trang | Mở văn bản Quyết định 1 trang | Hiển thị ngay lập tức, căn giữa chuẩn | *(Chờ test)* | [ ] |
| H.2 | Văn bản scan nhiều trang (>100 trang) | Mở Nghị định hoặc tài liệu dài | Cuộn mượt mà qua các trang; bộ nhớ giải phóng đúng | *(Chờ test)* | [ ] |
| H.3 | Thao tác Thu phóng (Zoom) | Bấm nút Zoom In (+), Zoom Out (-) | Tỉ lệ phóng to thu nhỏ mượt mà, chữ không bị vỡ | *(Chờ test)* | [ ] |
| H.4 | Chọn văn bản Cấp 1-2 | Bôi đen chuột sao chép chữ trên file Cấp 1 | TextLayer hoạt động, bôi đen và copy chính xác | *(Chờ test)* | [ ] |
| H.5 | Highlight bút dạ quang | Sử dụng công cụ vẽ highlight trên trang | Nét vẽ hiển thị đúng vị trí trên canvas overlay | *(Chờ test)* | [ ] |

---

**Xác nhận hoàn thành checklist:**  
- Ngày hoàn thành: `____ / ____ / 2026`  
- Ký tên xác nhận: `___________________________`

