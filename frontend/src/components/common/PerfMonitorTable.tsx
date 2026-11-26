/**
 * Bảng dùng chung của bảng đo hiệu năng: cột chia theo tỷ lệ chiều rộng, nội dung tự xuống dòng,
 * số thập phân làm tròn 4 chữ số, sắp xếp theo cột, tìm kiếm, mở rộng dòng, phân trang.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PaginationBar } from './PaginationBar';

export type PerfCell = string | number | null | undefined;

export interface PerfColumn<T> {
  key: string;
  title: string;
  /** tỷ lệ chiều rộng so với các cột khác */
  width: number;
  /** dec: số thập phân 4 chữ số · int: số nguyên · text: chữ */
  type?: 'dec' | 'int' | 'text';
  value: (row: T) => PerfCell;
  render?: (row: T) => React.ReactNode;
  tone?: (row: T) => 'warn' | 'bad' | undefined;
}

export const formatPerf = (value: PerfCell, type: PerfColumn<unknown>['type'] = 'text'): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value !== 'number') return value;
  if (!Number.isFinite(value)) return '—';
  if (type === 'int') return String(Math.round(value));
  if (type === 'dec') return value.toFixed(4);
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
};

/** Danh sách "tên: giá trị" của một bước */
export const PerfValueList: React.FC<{ values: Record<string, PerfCell> }> = ({ values }) => {
  const entries = Object.entries(values || {});
  if (!entries.length) return <span className="qk7perf-muted">—</span>;
  return (
    <ul className="qk7perf-values">
      {entries.map(([name, value]) => (
        <li key={name}><span>{name}:</span> <b>{formatPerf(value)}</b></li>
      ))}
    </ul>
  );
};

export const perfCellText = <T,>(column: PerfColumn<T>, row: T) => formatPerf(column.value(row), column.type);

interface PerfTableProps<T> {
  columns: PerfColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  query?: string;
  /** chữ dùng để tìm ngoài các cột (vd: giá trị của bước) */
  searchText?: (row: T) => string;
  expand?: (row: T) => React.ReactNode;
  emptyText?: string;
  initialSort?: { key: string; desc: boolean };
  pageSize?: number;
}

export function PerfTable<T>({
  columns, rows, rowKey, query = '', searchText, expand, emptyText = 'Chưa có số liệu', initialSort, pageSize = 50,
}: PerfTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(initialSort || null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Set<string | number>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('vi');
    let out = rows;
    if (q) {
      out = rows.filter((row) => (columns.map((c) => perfCellText(c, row)).join(' ') + ' ' + (searchText?.(row) || ''))
        .toLocaleLowerCase('vi').includes(q));
    }
    const column = sort && columns.find((c) => c.key === sort.key);
    if (column && sort) {
      out = [...out].sort((a, b) => {
        const x = column.value(a);
        const y = column.value(b);
        const order = typeof x === 'number' || typeof y === 'number'
          ? (Number(x ?? -Infinity) - Number(y ?? -Infinity))
          : String(x ?? '').localeCompare(String(y ?? ''), 'vi');
        return sort.desc ? -order : order;
      });
    }
    return out;
  }, [rows, columns, query, sort, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(1); }, [query, sort]);
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const totalWidth = columns.reduce((n, c) => n + c.width, 0);

  const toggleSort = (key: string) => setSort((s) => {
    if (!s || s.key !== key) return { key, desc: true };
    return s.desc ? { key, desc: false } : null;
  });
  const toggleRow = (key: string | number) => setOpen((s) => {
    const next = new Set(s);
    if (!next.delete(key)) next.add(key);
    return next;
  });

  return (
    <div className="qk7perf-tablewrap">
      <table className="qk7perf-table">
        <colgroup>
          {columns.map((c) => <col key={c.key} style={{ width: `${(c.width / totalWidth) * 100}%` }} />)}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.type && c.type !== 'text' ? 'is-num' : undefined}
                aria-sort={sort?.key === c.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}
              >
                <button type="button" onClick={() => toggleSort(c.key)} title={`Sắp xếp theo ${c.title}`}>
                  {c.title}{sort?.key === c.key ? (sort.desc ? ' ▼' : ' ▲') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const key = rowKey(row);
            const isOpen = open.has(key);
            return (
              <React.Fragment key={key}>
                <tr
                  className={expand ? `is-expandable${isOpen ? ' is-open' : ''}` : undefined}
                  onClick={expand ? () => toggleRow(key) : undefined}
                >
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={[c.type && c.type !== 'text' ? 'is-num' : '', c.tone?.(row) ? `is-${c.tone(row)}` : ''].join(' ').trim() || undefined}
                    >
                      {expand && i === 0 && (
                        <button
                          type="button" className="qk7perf-toggle" aria-expanded={isOpen}
                          aria-label={isOpen ? 'Thu gọn các bước' : 'Xem các bước'}
                          onClick={(e) => { e.stopPropagation(); toggleRow(key); }}
                        >
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      )}
                      {c.render ? c.render(row) : perfCellText(c, row)}
                    </td>
                  ))}
                </tr>
                {expand && isOpen && (
                  <tr className="qk7perf-detail"><td colSpan={columns.length}>{expand(row)}</td></tr>
                )}
              </React.Fragment>
            );
          })}
          {!visible.length && (
            <tr><td colSpan={columns.length} className="qk7perf-empty">{query ? 'Không có dòng nào khớp từ khóa' : emptyText}</td></tr>
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="qk7perf-pager">
          <span className="qk7perf-muted">{filtered.length} dòng</span>
          <PaginationBar currentPage={safePage} totalPages={totalPages} onPageChange={setPage} ariaLabel="Trang của bảng đo" />
        </div>
      )}
    </div>
  );
}
