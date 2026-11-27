import React, { useEffect, useState } from 'react';
import { Copy, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { documentsApi } from '../../services/documentsApi';
import type { DuplicateReport, DuplicateDocumentRef } from '../../services/documentService';
import { PaginationBar } from '../common/PaginationBar';
import { TacticalEmptyState } from '../common/TacticalEmptyState';

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
    <div className="space-y-4">
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-600 dark:border-l-amber-400 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200/80 dark:border-amber-500/30 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-400">
              <Copy className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Đối Soát Tài Liệu Trùng
                </h1>
                {s && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono tabular-nums bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/30">
                    {s.groups} nhóm trùng
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Phát hiện các văn bản có mã băm SHA-256 tệp PDF giống hệt nhau. Trang này chỉ phục vụ kiểm tra đối soát, không tự động xóa hay sửa dữ liệu.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={load}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer select-none self-start sm:self-center disabled:opacity-40 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#166534] dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>Quét lại</span>
          </button>
        </div>

        {s && !error && (
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            {[
              ['Tệp PDF đã quét', s.scanned_files],
              ['Nhóm trùng', s.groups],
              ['Tệp dư', `${s.extra_files} (${formatSize(s.extra_bytes)})`],
              ['Tệp mồ côi', s.orphan_files],
              ['Bản ghi thiếu tệp', s.missing_records],
            ].map(([label, value]) => (
              <div key={String(label)} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                <dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-white mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

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
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 py-10 px-4 shadow-xs">
          <TacticalEmptyState
            title="Không có tài liệu trùng"
            description="Toàn bộ tệp PDF trong kho lưu trữ hiện có mã băm SHA-256 duy nhất, không phát hiện tệp trùng nội dung."
            icon={<CheckCircle2 className="w-7 h-7 text-[#166534] dark:text-emerald-400" />}
            compact
          />
        </div>
      ) : (
        <div className="space-y-3">
          {pageGroups.map((g, index) => (
            <section
              key={g.sha256}
              className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
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
    </div>
  );
};
