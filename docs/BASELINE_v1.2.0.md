# Baseline v1.2.0 — Trước khi đóng 4 gap

## Ngày: 2026-10-27 18:52

## v1.1.0 reference
- Branch: feature/complete-boxchat-v1 / haianh-dev
- Tag: v1.1.0-boxchat-complete
- Commit: 10c14b49

## Current metrics (kết quả thực tế đo đạc)
- pytest: 14/14 PASS (18.07s)
- eval_rag (30 câu): Hit Rate 100.0% (30/30), Citation 100.0% (5/5), Latency trung bình 6516.53 ms, Trích dẫn giả mạo: 0
- RAGAS: Faithfulness 94.43%, Relevance 98.20% (từ chứng nhận v1.1.0)
- E2E: 15/15 PASS
- Health: `{"status":"online","service":"boxchat","port":8001,"total_chunks_indexed":294,"ollama_connected":true,"security_enforcement":"Strict Pre-filtering (1-5)"}`

## Current state
- Chunks: 294
- Model: qwen2.5:3b
- VRAM usage: 3371MiB / 4096MiB (NVIDIA GeForce GTX 1650 4GB)
- Python: WindowsApps (`C:\Users\PC\AppData\Local\Microsoft\WindowsApps\python.exe`)
- Monitoring: KHÔNG CÓ
- Load test: CHƯA CHẠY

## Quyết định
- Target v1.2.0: đóng G1 (Monitoring/Alerting), G2 (Adversarial Hardening), G3 (Load/Stress Test), G4 (Technical Debt & Model Strategy)
- Ngưỡng thành công:
  - Monitoring: Prometheus endpoint (`/metrics`) + 3 alert rules hoạt động
  - Adversarial: 15/15 câu bị từ chối đúng (0 leak, 0 injection)
  - Load: 10 concurrent × P95 < 15s, error rate 0%
  - Docs: cập nhật đầy đủ toàn bộ chứng chỉ và quy trình vận hành
