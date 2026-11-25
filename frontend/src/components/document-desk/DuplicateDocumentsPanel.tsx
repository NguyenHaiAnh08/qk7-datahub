import React, { useEffect, useState } from 'react';
import { Copy, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { documentsApi } from '../../services/documentsApi';
import type { DuplicateReport, DuplicateDocumentRef } from '../../services/documentService';
import { PaginationBar } from '../common/PaginationBar';

const GROUPS_PER_PAGE = 20;

const formatSize = (bytes: number) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

const STATE_BADGE: Record<DuplicateDocumentRef['state'], { label: string; cls: string }> = {
  ACTIVE: { label: 'Đang dùng', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30' },
  PENDING: { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30' },
  TRASH: { label: 'Trong thùng rác', cls: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700' },
};

/** Báo cáo tài liệu trùng nội dung — chỉ xem, không xóa hay sửa dữ liệu */
export const DuplicateDocumentsPanel: React.FC = () => {
  const [report, setReport] = useState<DuplicateReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await documentsApi.getDuplicates());
      setPage(1);
    } catch (err: any) {
      setError(err?.message || 'Không thể kiểm tra tài liệu trùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const groups = report?.groups || [];
  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
  const pageGroups = groups.slice((page - 1) * GROUPS_PER_PAGE, page * GROUPS_PER_PAGE);
  const s = report?.summary;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Copy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span>Tài Liệu Trùng</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Các văn bản có nội dung tệp PDF giống hệt nhau. Trang này chỉ để kiểm tra, không xóa hay sửa dữ liệu.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={load}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700/90 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer select-none self-start disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>Quét lại</span>
        </button>
      </div>

      {s && !error && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          {[
            ['Tệp PDF đã quét', s.scanned_files],
            ['Nhóm trùng', s.groups],
            ['Tệp dư', `${s.extra_files} (${formatSize(s.extra_bytes)})`],
            ['Tệp không bản ghi nào dùng', s.orphan_files],
            ['Bản ghi bị thiếu tệp', s.missing_records],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex items-baseline gap-1.5">
              <dt>{label}:</dt>
              <dd className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {error ? (
        <div className="flex items-center gap-2 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:border-rose-500/30 dark:text-rose-300 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : loading && !report ? (
        <div className="py-16 flex flex-col items-center gap-2 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="text-xs font-medium">Đang quét thư mục lưu trữ...</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 flex flex-col items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Không có tài liệu trùng</span>
        </div>
      ) : (
        <div className="space-y-3">
          {pageGroups.map((g, index) => (
            <section
              key={g.sha256}
              className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              <header className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="font-bold text-slate-900 dark:text-white">
                  Nhóm {(page - 1) * GROUPS_PER_PAGE + index + 1}
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  {g.documents.length} bản ghi ({g.active_count} đang dùng), {g.files.length} tệp trên máy chủ
                  {g.size ? `, mỗi tệp ${formatSize(g.size)}` : ''}
                </span>
                <span className="font-mono text-slate-400" title={g.sha256}>
                  SHA {g.sha256.slice(0, 12)}
                </span>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[860px]">
                  <thead className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80">
                    <tr>
                      <th className="py-2 px-4 w-40">Số hiệu</th>
                      <th className="py-2 px-4">Trích yếu</th>
                      <th className="py-2 px-4 w-44">Người đăng</th>
                      <th className="py-2 px-4 w-44">Ngày đăng</th>
                      <th className="py-2 px-4 w-36">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {g.documents.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-3 px-4 text-slate-500">
                          Không có văn bản nào dùng các tệp này (xem danh sách tệp bên dưới).
                        </td>
                      </tr>
                    )}
                    {g.documents.map((d) => (
                      <tr key={d.file_id}>
                        <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                          {d.document_code || d.file_id}
                        </td>
                        <td className="py-2.5 px-4 text-slate-900 dark:text-white">
                          <span className="line-clamp-2" title={d.title}>{d.title}</span>
                          {d.unit_name && <span className="block text-slate-400">{d.unit_name}</span>}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{d.uploader_name || '—'}</td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {d.created_at ? new Date(d.created_at).toLocaleString('vi-VN') : '—'}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${STATE_BADGE[d.state].cls}`}>
                            {STATE_BADGE[d.state].label}
                          </span>
                          {d.file_missing && (
                            <span className="block mt-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">Thiếu tệp</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {g.files.length > 0 && (
                <ul className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                  {g.files.map((f) => (
                    <li key={f.path} className="flex flex-wrap items-baseline gap-x-3 text-[11px]">
                      <span className="font-mono text-slate-600 dark:text-slate-300 break-all">{f.path}</span>
                      <span className={f.orphan ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-slate-400'}>
                        {f.orphan
                          ? 'Không bản ghi nào dùng'
                          : [f.refs ? `${f.refs} bản ghi dùng` : '', f.proposals ? `${f.proposals} đề xuất dùng` : '']
                              .filter(Boolean)
                              .join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {totalPages > 1 && (
            <div className="flex justify-end">
              <PaginationBar currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}
    </>
  );
};
