# HTTPS noi bo — trien khai may chu va may con

Nguyen tac: may con chi tin **Root CA** (cai 1 lan). Doi may chu = cap chung chi moi tu cung Root CA, may con khong phai lam gi.

## May chu (moi lan dung may chu moi / gia han)
1. Chep `mkcert.exe` vao `may-chu/`.
2. Sua `DOMAIN`, `SERVER_IP`, `EXTRA_NAMES` trong `cap-chung-chi-may-chu.bat`, chay (Admin).
   - Lan dau tu tao Root CA; lan sau dung lai thu muc `RootCA/` neu con.
3. Chep cac dong trong `env-https.mau` vao `backend/.env`, restart backend.
4. Kiem tra: mo `https://<ten-mien>:8000` tren chinh may chu, thay o khoa an toan.

## May con (1 lan / may)
1. Chep `may-chu/certs/rootCA.crt` + `may-con/cai-rootca-may-con.bat` vao cung thu muc (USB).
2. Sua `DOMAIN`, `SERVER_IP` o dau file .bat, chuot phai -> Run as administrator.
3. Mo lai trinh duyet. May co Domain: dung GPO thay cho buoc nay (Public Key Policies).
4. iPad: cai ho so chung chi, roi Cai dat > Gioi thieu > Cai dat tin cay chung chi > bat tin cay.

## BAT BUOC
- Sao luu **ca thu muc `may-chu/RootCA/`** (dac biet `rootCA-key.pem`) vao noi an toan. Mat khoa = phai cai lai Root CA cho TOAN BO may con.
- `rootCA-key.pem` KHONG phat cho may con, KHONG dua len git (`.gitignore` da chan `*.pem`, `*.key`, `*.crt`).
- Chung chi may chu het han sau ~2 nam 3 thang, Root CA ~10 nam. Ghi ngay het han vao so van hanh.
- Web bat HSTS: cai Root CA cho **toan bo may con TRUOC**, roi moi chuyen may chu sang chung chi moi.
- Bo cai van tay: tro bang TEN MIEN (khong IP cung) de doi may chu chi can doi DNS.


Các bước dưới đây chạy trên máy này (làm máy chủ thử), sau đó đến từng máy con. Mở PowerShell bằng quyền Administrator cho bước 1 và 2.

A. Trên máy này (máy chủ thử)
Bước 1. Cho máy này tin Root CA mới


certutil -addstore -f Root "C:\QK7_DataHub\qk7-datahub\deploy\https\may-chu\certs\rootCA.crt"
Nếu thành công sẽ thấy CertUtil: -addstore command completed successfully.

Bước 2. Trỏ tên miền về máy này để test

Máy này chưa có IP 172.22.1.111, nên tạm trỏ về chính nó:


Add-Content "$env:SystemRoot\System32\drivers\etc\hosts" "127.0.0.1   trungtamdulieuso.tqs.com"
Khi có máy chủ thật, sửa dòng này thành 172.22.1.111, hoặc xóa nếu mạng đã có DNS nội bộ.

Bước 3. Bật HTTPS cho backend

Mở backend/.env và đặt các dòng sau. Nếu khóa nào đã có thì sửa tại chỗ, đừng thêm dòng trùng:


USE_HTTPS=true
SSL_KEY_PATH=../deploy/https/may-chu/certs/server.key
SSL_CERT_PATH=../deploy/https/may-chu/certs/server.crt
SERVER_DOMAIN=trungtamdulieuso.tqs.com
SERVER_IP=172.22.1.111
CORS_ALLOWED_ORIGINS=https://trungtamdulieuso.tqs.com:8000,https://172.22.1.111:8000
Bước 4. Khởi động lại backend






























=========================================================================================================================================================================


cd C:\QK7_DataHub\qk7-datahub\backend
node server.js
Bước 5. Kiểm tra

Lệnh này không có -k, nên nếu chứng chỉ không tin cậy thì sẽ báo lỗi:


curl.exe -I https://trungtamdulieuso.tqs.com:8000
Sau đó đóng hết trình duyệt, mở lại https://trungtamdulieuso.tqs.com:8000 và kiểm tra ổ khóa có hợp lệ không. Chrome và Edge dùng kho tin cậy của Windows nên nhận ngay. Firefox cần chạy bước 2 trong script máy con (khóa registry).

B. Từng máy con (làm một lần cho mỗi máy)
Chép 2 file vào cùng một thư mục trên USB:
deploy\https\may-chu\certs\rootCA.crt
deploy\https\may-con\cai-rootca-may-con.bat
Trên máy con, chuột phải vào file .bat → Run as administrator. Script tự làm 4 việc: cài Root CA, bật tin cậy cho Firefox, trỏ tên miền về 172.22.1.111 trong file hosts, rồi kiểm tra.
Đóng hết trình duyệt và mở lại https://trungtamdulieuso.tqs.com:8000.
Thứ tự bắt buộc là cài Root CA cho toàn bộ máy con trước, rồi mới đổi máy chủ sang chứng chỉ mới. Lý do là web đang bật HSTS, nên máy con chưa tin Root CA mới sẽ bị chặn hẳn, không bấm bỏ qua được.

C. Khi có máy chủ thật (IP 172.22.1.111)
Chép nguyên thư mục deploy\https\may-chu\ sang máy chủ, kể cả RootCA\. Không cần chạy lại cap-chung-chi-may-chu.bat, vì chứng chỉ đã chứa sẵn 172.22.1.111.
Đặt IP tĩnh 172.22.1.111 cho máy chủ.
Lặp lại bước 3 và 4 ở trên. Nếu .env đã đúng thì chỉ cần khởi động backend.
Mở cổng 8000 trên Windows Firewall của máy chủ:

New-NetFirewallRule -DisplayName "QK7 HTTPS 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
Các máy con không phải làm lại gì, vì chúng đã tin Root CA.