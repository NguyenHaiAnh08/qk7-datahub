import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  RotateCw,
  Eraser,
  Calendar,
  Shield,
  Building,
  LayoutGrid,
  List,
  AlertTriangle,
  X,
  FileCheck
} from 'lucide-react';
import { Header } from '../components/common/Header';
import { Toast, ToastState } from '../components/common/Toast';
import { SecurityBanner } from '../components/portal/SecurityBanner';
import { PortalDocumentList } from '../components/portal/PortalDocumentList';
import { DocumentTable } from '../components/document-desk/DocumentTable';
import { DocumentPreviewModal } from '../components/document-desk/DocumentPreviewModal';
import { documentsApi } from '../services/documentsApi';
import { dashboardApi } from '../services/dashboardApi';
import { useAuth } from '../hooks/useAuth';
import { DocumentItem, MetaData } from '../types';

const ITEMS_PER_PAGE = 9;

export const PortalPage: React.FC = () => {
  const { user } = useAuth();

  // Metadata
  const [meta, setMeta] = useState<MetaData>({ types: [], units: [], levels: [] });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<number>(user?.clearance_level_id || 1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Documents
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [showSecurityPolicy, setShowSecurityPolicy] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 2800);
  };

  // Load Metadata
  useEffect(() => {
    dashboardApi
      .getMeta()
      .then((res) => {
        setMeta(res);
        if (user) {
          setSelectedLevel(user.clearance_level_id);
        }
      })
      .catch((err) => console.error('[loadMeta]', err));
  }, [user]);

  // Load Documents
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await documentsApi.getDocuments({
        code: searchQuery || undefined,
        type: selectedType || undefined,
        unit: selectedUnit || undefined,
        lv: selectedLevel || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setDocuments(res.items || []);
      setCurrentPage(1);
    } catch (err: any) {
      showToast('Lỗi tải tài liệu: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadDocuments();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedType, selectedUnit, selectedLevel, dateFrom, dateTo]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('');
    setSelectedUnit('');
    setSelectedLevel(user?.clearance_level_id || 1);
    setDateFrom('');
    setDateTo('');
  };

  // Download Handler
  const handleDownload = async (doc: DocumentItem) => {
    if ((doc.security_level_id || 1) >= 3) {
      showToast('Tài liệu từ Cấp 3 trở lên chỉ duy nhất cho phép xem trực tiếp, không được tải về (không đủ điều kiện cấp bậc)', 'error');
      return;
    }
    try {
      showToast(`Đang tải văn bản ${doc.document_code}...`, 'info');
      await documentsApi.downloadDocument(doc.file_id, doc.original_name || `${doc.document_code}.pdf`);
      showToast(`Đã tải xuống văn bản ${doc.document_code}`, 'success');
    } catch (err: any) {
      showToast('Lỗi tải văn bản: ' + (err.message || 'Không có quyền truy cập'), 'error');
    }
  };

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(documents.length / ITEMS_PER_PAGE));
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return documents.slice(start, start + ITEMS_PER_PAGE);
  }, [documents, currentPage]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Header */}
      <Header
        activeNav="portal"
        title="QK7 DATAHUB"
        subtitle="Cổng Tra Cứu Tài Liệu Quân Sự Tập Trung"
      />

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Security Banner */}
        <SecurityBanner
          user={user}
          onOpenPolicy={() => setShowSecurityPolicy(true)}
        />

        {/* Filter & View Mode Controls */}
        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm transition-colors duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm số hiệu, trích yếu..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Document Type Dropdown */}
            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="">Tất cả thể loại văn bản</option>
                {meta.types.map((t) => (
                  <option key={t.type_id} value={t.type_id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Issuing Unit Dropdown */}
            <div>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="">Tất cả đơn vị ban hành</option>
                {meta.units.map((u) => (
                  <option key={u.unit_id} value={u.unit_id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Security Level Dropdown */}
            <div>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              >
                {meta.levels.map((l) => (
                  <option key={l.level_id} value={l.level_id}>
                    Tài liệu ≤ {l.name} (Cấp {l.level_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sub Filters & View Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-slate-600 dark:text-slate-400 text-[11px]">Từ ngày:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-slate-600 dark:text-slate-400 text-[11px]">Đến:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-2 justify-end">
              <div className="p-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition ${
                    viewMode === 'grid'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                  title="Dạng lưới thẻ"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded transition ${
                    viewMode === 'table'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                  title="Dạng bảng chi tiết"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
              <button
                type="button"
                onClick={loadDocuments}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Làm mới</span>
              </button>
            </div>
          </div>
        </div>

        {/* Document Content View */}
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

      {/* Preview Modal */}
      <DocumentPreviewModal
        open={Boolean(previewDoc)}
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {/* Security Policy Modal */}
      <AnimatePresence>
        {showSecurityPolicy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-xs space-y-4 text-slate-700 dark:text-slate-300 transition-colors duration-200"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-500" />
                  Quy Chế An Ninh Dữ Liệu Quân Khu 7
                </h3>
                <button
                  onClick={() => setShowSecurityPolicy(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2.5 text-slate-600 dark:text-slate-300">
                <p>
                  1. Nghiêm cấm mọi hành vi sao chép, trích xuất hoặc chia sẻ tài liệu vượt quá phạm vi phân quyền quân nhân.
                </p>
                <p>
                  2. Địa chỉ IP, thời gian truy xuất, mã định danh người dùng và vân tay tệp (SHA-256) được kiểm toán và giám sát liên tục 24/7.
                </p>
                <p>
                  3. Văn bản thuộc cấp độ MẬT, TỐI MẬT, TUYỆT MẬT phải được bảo quản và khai thác theo đúng Quy chuẩn Bảo vệ Bí mật Nhà nước trong Quân đội.
                </p>
              </div>
              <button
                onClick={() => setShowSecurityPolicy(false)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer shadow-md shadow-emerald-600/30"
              >
                Tôi Đã Hiểu Và Cam Kết Tuân Thủ
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
    </div>
  );
};
