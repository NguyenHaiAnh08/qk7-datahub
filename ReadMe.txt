1. Hiện tại 6/10/2025 đang dùng dữu liệu ảo để test
2. Dữ liệu lấy test là IP trong file config

 // Đang dùng cái này
 // Tạo 3 server giả lập trên dải Loopback (Tự động chạy, không cần chỉnh card mạng)
mapIpToFolder('127.0.0.10', 3000, 'C:\\Private_2\\DataSever#1', 'Máy 1 - Hành chính');
mapIpToFolder('127.0.0.11', 3000, 'C:\\Private_2\\DataSever#2', 'Máy 2 - Tài chính');
mapIpToFolder('127.0.0.12', 3000, 'C:\\Private_2\\DataSever#3', 'Máy 3 - Lưu trữ');

// Thực tế trong file config
[
  { "id": "Server1", "name": "Máy chủ Hành chính", "ip": "127.0.0.10", "port": 3000 },
  { "id": "Server2", "name": "Máy chủ Tài chính",  "ip": "127.0.0.11", "port": 3000 },
  { "id": "Server3", "name": "Máy chủ Lưu trữ",    "ip": "127.0.0.12", "port": 3000 }
]