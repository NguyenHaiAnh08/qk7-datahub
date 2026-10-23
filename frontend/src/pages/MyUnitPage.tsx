import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, RotateCw, Eraser, Calendar, Building,
  LayoutGrid, List,
} from 'lucide-react';
import { TreeSelect } from 'antd';
import { Header } from '../components/common/Header';
import { Toast, ToastState } from '../components/common/Toast';
import { PortalDocumentList } from '../components/portal/PortalDocumentList';
import { DocumentTable } from '../components/document-desk/DocumentTable';
import { DocumentPreviewModal } from '../components/document-desk/DocumentPreviewModal';
import { documentsApi } from '../services/documentsApi';
import { dashboardApi } from '../services/dashboardApi';
import { documentService, MyUnitDocumentResponse } from '../services/documentService';
import { useAuth } from '../hooks/useAuth';
import { DocumentItem, MetaData } from '../types';
import { buildUnitTree } from '../utils/unitTree';

const ITEMS_PER_PAGE = 9;

export const MyUnitPage: React.FC = () => {
  const { user } = useAuth();

  const [meta, setMeta] = useState<MetaData>({ types: [], units: [], levels: [] });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [canSelectUnit, setCanSelectUnit] = useState(false);
  const [currentUnit, setCurrentUnit] = useState<{ unit_id: string; name: string } | null>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 2800);
  };

  useEffect(() => {
    dashboardApi.getMeta().then(setMeta).catch((err) => console.error('[meta]', err));
  }, []);

  const unitTree = useMemo(() => buildUnitTree(meta.units), [meta.units]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res: MyUnitDocumentResponse = await documentService.getMyUnitDocuments({
        unit_id: selectedUnitId || undefined,
        // code: searchQuery || undefined,
        q: searchQuery || undefined,
        type: selectedType || undefined,
        lv: selectedLevel !== '' ? Number(selectedLevel) : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setDocuments(res.items || []);
      setCanSelectUnit(res.can_select_unit);
      setCurrentUnit(res.unit);
      if (!selectedUnitId && res.selected_unit_id) {
        setSelectedUnitId(res.selected_unit_id);
      }
      setCurrentPage(1);
    } catch (err: any) {
      showToast('Lỗi tải tài liệu: ' + (err.message || 'Không xác định'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { loadDocuments(); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedType, selectedLevel, selectedUnitId, dateFrom, dateTo]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('');
    setSelectedLevel('');
    setDateFrom('');
    setDateTo('');
    if (!canSelectUnit && user?.unit_id) {
      setSelectedUnitId(user.unit_id);
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    const userClearance = user?.clearance_level_id || 1;
    const docLevel = doc.security_level_id || 1;
    if (docLevel >= 3) {
      showToast('Tài liệu từ Cấp 3 trở lên chỉ duy nhất cho phép xem trực tiếp, không được phép tải về máy.', 'info');
      return;
    }
    if (docLevel > userClearance) {
      showToast(`Cấp độ bảo mật hiện tại (Cấp ${userClearance}) không đủ để tải văn bản Cấp ${docLevel}`, 'error');
      return;
    }
    try {
      await documentsApi.downloadDocument(doc.file_id, doc.original_name || `${doc.document_code}.pdf`);
      showToast(`Đã tải xuống ${doc.document_code}`, 'success');
    } catch (err: any) {
      showToast('Lỗi tải: ' + err.message, 'error');
    }
  };

  const totalPages = Math.max(1, Math.ceil(documents.length / ITEMS_PER_PAGE));
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return documents.slice(start, start + ITEMS_PER_PAGE);
  }, [documents, currentPage]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header
        activeNav="myunit"
        title="Trường Quân Sự Quân Khu 7"
        subtitle={currentUnit ? `Đơn vị: ${currentUnit.name}` : 'Trung tâm dữ liệu số'}
      />

      <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-6 xl:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-white dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Building className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Trung tâm thư viện số: {currentUnit?.name || '...'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {canSelectUnit
                  ? 'Bạn có quyền chọn đơn vị để xem tài liệu. Mặc định hiển thị đơn vị của bạn.'
                  : 'Chỉ hiển thị tài liệu của đơn vị bạn trực thuộc.'}
              </p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {canSelectUnit ? (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Đơn vị
                </label>
                <TreeSelect
                  value={selectedUnitId || undefined}
                  onChange={(val) => setSelectedUnitId(val || '')}
                  treeData={unitTree}
                  placeholder="Chọn đơn vị..."
                  allowClear
                  treeDefaultExpandAll
                  treeNodeLabelProp="name"
                  treeNodeFilterProp="name"
                  showSearch
                  style={{ width: '100%' }}
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Đơn vị (cố định)
                </label>
                <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Building className="w-3.5 h-3.5" />
                  <span>{currentUnit?.name || '—'}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Tìm kiếm
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Số hiệu, trích yếu..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Loại văn bản
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">Tất cả</option>
                {meta.types.map((t) => (
                  <option key={t.type_id} value={t.type_id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Mức bảo mật
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">Tất cả</option>
                {meta.levels.map((l) => (
                  <option key={l.level_id} value={l.level_id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] text-slate-600 dark:text-slate-400">Từ:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200"
              />
              <span className="text-[11px] text-slate-600 dark:text-slate-400">Đến:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="flex items-center space-x-2 justify-end">
              <div className="p-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
                  title="Dạng lưới"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
                  title="Dạng bảng"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
              <button
                type="button"
                onClick={loadDocuments}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Làm mới</span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <PortalDocumentList
            documents={paginatedDocs}
            userClearanceLevel={user?.clearance_level_id || 1}
            loading={loading}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={documents.length}
            onPageChange={setCurrentPage}
            onPreview={(doc) => setPreviewDoc(doc)}
            onDownload={handleDownload}
          />
        ) : (
          <DocumentTable
            documents={paginatedDocs}
            userClearanceLevel={user?.clearance_level_id || 1}
            loading={loading}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={documents.length}
            onPageChange={setCurrentPage}
            onPreview={(doc) => setPreviewDoc(doc)}
            onDownload={handleDownload}
          />
        )}
      </main>

      <DocumentPreviewModal
        open={Boolean(previewDoc)}
        document={previewDoc}
        userClearanceLevel={user?.clearance_level_id || 1}
        onClose={() => setPreviewDoc(null)}
      />

      <Toast toast={toast} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
    </div>
  );
};

export default MyUnitPage;