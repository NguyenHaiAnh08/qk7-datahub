// // frontend/src/hooks/useApprovalCount.ts
// /**
//  * @deprecated Từ 2026-10-27, dùng `useApprovalContext()` trực tiếp.
//  *
//  * Hook này giữ lại dưới dạng thin wrapper để tương thích ngược.
//  * Poll thực tế đã được tập trung ở `ApprovalProvider` — hook này KHÔNG tạo timer riêng.
//  *
//  * Signature cũ vẫn giữ nguyên: `useApprovalCount(pollMs, enabled)`,
//  * nhưng các tham số bị bỏ qua vì đã được ApprovalContext tự xử lý.
//  */
// import { useApprovalContext } from '../contexts/ApprovalContext';

// export function useApprovalCount(_pollMs = 30000, _enabled = true) {
//   const { count, refresh, isPolling } = useApprovalContext();
//   return { count, refresh, isPolling };
// }