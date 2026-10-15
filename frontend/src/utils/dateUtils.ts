/**
 * Format ISO date string to Vietnamese local date / time string
 */
export function formatDateVN(isoString?: string | null, includeTime = false): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;

  if (includeTime) {
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false
    });
  }

  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Alias for formatDateVN
 */
export const formatDate = formatDateVN;

/**
 * Format ISO date for HTML <input type="date"> (YYYY-MM-DD)
 */
export function formatDateForInput(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}
