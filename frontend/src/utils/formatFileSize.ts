/**
 * Format bytes to human readable string (B, KB, MB, GB)
 */
export function formatFileSize(bytes?: number | string | null): string {
  if (bytes === undefined || bytes === null || bytes === '') return '0 B';
  const b = Number(bytes);
  if (isNaN(b) || b <= 0) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + ' MB';
  return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
