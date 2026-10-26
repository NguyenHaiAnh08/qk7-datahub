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
  FileCheck,
  Compass,
} from 'lucide-react';
import { Header } from '../components/common/Header';
import { toast } from '../components/common/Toast';
import { SecurityBanner } from '../components/portal/SecurityBanner';
import { PortalDocumentList } from '../components/portal/PortalDocumentList';
import { DocumentTable } from '../components/document-desk/DocumentTable';
import { DocumentPreviewModal } from '../components/document-desk/DocumentPreviewModal';
import { DateRangePicker } from '../components/common/DateRangePicker';
import { SpotlightTour } from '../components/common/SpotlightTour';
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
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<number | ''>('');
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
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Auto-launch spotlight tour for first-time guest visitors
  useEffect(() => {
    const isGuest = !user || user.user_id === 'GUEST';
    if (isGuest) {
      const tourSeen = localStorage.getItem('qk7_guest_tour_seen');
      if (!tourSeen) {
        const timer = setTimeout(() => {
          setIsTourOpen(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedType('');
    setSelectedUnit('');
    setSelectedDepartment('');
    setSelectedLevel('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  // Load Metadata
  useEffect(() => {
    dashboardApi
      .getMeta()
      .then((res) => {
        setMeta(res);
      })
      .catch((err) => console.error('[loadMeta]', err));
  }, [user]);

  // Sub-departments of Truong Quan su Quan khu 7 (TQS)
  const tqsDepartments = useMemo(() => {
    const list = meta.units.filter((u) => u.parent_id === 'TQS' || u.parent_id === 'U-TQS');
    if (list.length > 0) return list;
    return [
      { unit_id: 'U-BGH', name: 'Ban Giám hiệu' },
      { unit_id: 'U-TM', name: 'Phòng Tham mưu - Hành chính' },
      { unit_id: 'U-CT', name: 'Phòng Chính trị' },
      { unit_id: 'U-HC', name: 'Phòng Hậu cần - Kỹ thuật' },
    ];
  }, [meta.units]);

  // Load Documents
  const loadDocuments = async () => {
    
    setLoading(true);
    try {
      let queryUnit: string | undefined = undefined;
      let includeChildren: boolean | undefined = undefined;

      if (selectedUnit === 'TQS') {
        if (selectedDepartment) {
          queryUnit = selectedDepartment;
          includeChildren = false;
        } else {
          queryUnit = 'TQS';
          includeChildren = true;
        }
      } else if (selectedUnit) {
        queryUnit = selectedUnit;
        includeChildren = false;
      }

      const res = await documentsApi.getDocuments({
        q: searchQuery || undefined,
        type: selectedType || undefined,
        unit: queryUnit,
        include_children: includeChildren,
        lv: selectedLevel !== '' ? Number(selectedLevel) : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setDocuments(res.items || []);
      setCurrentPage(1);
    } catch (err: any) {
      if (err?.status === 401) {
        // Đã xử lý global bởi HttpErrorListener, bỏ qua local toast
        return;
      }
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
  }, [searchQuery, selectedType, selectedUnit, selectedDepartment, selectedLevel, dateFrom, dateTo]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('');
    setSelectedUnit('');
    setSelectedDepartment('');
    setSelectedLevel('');
    setDateFrom('');
    setDateTo('');
  };

  // Download Handler with deferred release when UI/UX finishes
  const handleDownload = async (doc: DocumentItem, signal?: AbortSignal) => {
    const userClearance = user?.clearance_level_id || 1;
    const docLevel = doc.security_level_id || 1;

    // Quy định bảo mật: Từ Cấp 3 trở đi chỉ duy nhất cho phép xem, không được tải về
    if (docLevel >= 3) {
      toast.securityAlert(
        'Tài liệu từ Cấp 3 trở lên chỉ duy nhất cho phép xem trực tiếp có xác thực vân tay 2FA, tuyệt đối không được phép tải về máy theo quy định tác chiến.',
        { title: 'QUY ĐỊNH BẢO MẬT QUÂN KHU', badge: 'LEVEL-3+' }
      );
      throw new Error('Tài liệu Cấp 3+ không được phép tải về');
    }

    if (docLevel > userClearance) {
      toast.securityAlert(
        `Cấp độ bảo mật hiện tại của đồng chí (Cấp ${userClearance}) không đủ để tải văn bản Cấp ${docLevel}.`,
        { title: 'TỪ CHỐI TRUY CẬP', badge: 'CLEARANCE-DENIED' }
      );
      throw new Error('Không đủ cấp độ bảo mật');
    }

    toast.info(`Đang truyền phát và chuẩn bị văn bản ${doc.document_code}...`, {
      title: 'ĐANG XỬ LÝ TỆP',
      badge: 'STREAMING',
      duration: 3200,
    });

    // Chuẩn bị tệp tải về và giữ lại (hold) cho đến khi thanh tiến trình UI hoàn tất 100%
    const release = await documentsApi.prepareDownload(
      doc.file_id,
      doc.original_name || `${doc.document_code}.pdf`,
      undefined,
      signal
    );

    // Trả về hàm release để CompactDownloadButton chỉ kích hoạt tải file về máy khi UI đã 'done'
    return () => {
      release();
      toast.success(`Đã tải xuống thành công văn bản ${doc.document_code}`, {
        title: 'TẢI TỆP HOÀN TẤT',
        badge: 'PDF-READY',
      });
    };
  };

  const handleCancelDownload = (doc: DocumentItem) => {
    toast.info(`Đã hủy tải văn bản ${doc.document_code}`, {
      title: 'ĐÃ HỦY TẢI',
      badge: 'CANCELLED',
      duration: 2000,
    });
  };

  const handleDirectDownload = async (doc: DocumentItem) => {
    try {
      const release = await handleDownload(doc);
      if (typeof release === 'function') {
        release();
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error('Lỗi tải văn bản: ' + (err.message || 'Không có quyền truy cập'), {
          title: 'THẤT BẠI',
          badge: 'DOWNLOAD-ERR',
        });
      }
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
        title="Trường Quân Sự Quân Khu 7"
        subtitle="Trung tâm dữ liệu số"
      />

      {/* Main Container */}
      <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-6 xl:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Security Banner */}
        <SecurityBanner
          user={user}
          onOpenPolicy={() => setShowSecurityPolicy(true)}
          onStartTour={() => setIsTourOpen(true)}
        />

        {/* Filter & View Mode Controls */}
        <div
          id="tour-filter-bar"
          className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/[0.08] space-y-4 transition-colors duration-200"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm số hiệu, trích yếu..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
              />
            </div>

            {/* Document Type Dropdown */}
            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 transition [&>option]:bg-white [&>option]:text-slate-800 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
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
                onChange={(e) => {
                  setSelectedUnit(e.target.value);
                  setSelectedDepartment('');
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 transition cursor-pointer [&>option]:bg-white [&>option]:text-slate-800 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
              >
                <option value="">Tất cả đơn vị ban hành</option>
                <option value="TQS">Trường Quân sự Quân khu 7</option>
                <option value="QK7">Quân khu 7</option>
                <option value="BTTM">Bộ Tổng Tham mưu</option>
                <option value="TCCT">Tổng cục Chính trị</option>
                <option value="BQP">Bộ Quốc phòng</option>
              </select>
            </div>

            {/* Security Level Dropdown */}
            <div>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 transition [&>option]:bg-white [&>option]:text-slate-800 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
              >
                <option value="">Tất cả cấp độ</option>
                {meta.levels.map((l) => (
                  <option key={l.level_id} value={l.level_id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sub Filters & View Switcher */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
              {/* Col 1 & 2: Khung ngày (bên trái) */}
              <div id="tour-date-range" className="sm:col-span-2 flex items-center space-x-2 text-xs">
                <DateRangePicker
                  startDate={dateFrom}
                  endDate={dateTo}
                  onChange={(start, end) => {
                    setDateFrom(start);
                    setDateTo(end);
                  }}
                  onClear={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                />
              </div>

              {/* Col 3: Ô chọn phòng ban (Nằm ở Cột 3 - ĐỐI DIỆN VÀ NẰM NGAY DƯỚI Ô "Đơn vị ban hành") */}
              <div>
                {selectedUnit === 'TQS' ? (
                  <div className="animate-in fade-in duration-200">
                    <select
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="w-full px-3 py-2 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-400 dark:border-emerald-700/70 rounded-xl text-xs font-medium text-emerald-950 dark:text-emerald-200 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition shadow-sm cursor-pointer"
                    >
                      <option value="">Tất cả phòng ban</option>
                      {tqsDepartments.map((d) => (
                        <option key={d.unit_id} value={d.unit_id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="hidden lg:block" />
                )}
              </div>

              {/* Col 4: Nút điều khiển & chuyển chế độ xem */}
              <div className="flex items-center space-x-2 justify-end">
                <div className="p-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded transition ${
                      viewMode === 'grid'
                        ? 'bg-[#166534] dark:bg-emerald-600 text-white shadow-sm'
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
                        ? 'bg-[#166534] dark:bg-emerald-600 text-white shadow-sm'
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
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Xóa bộ lọc</span>
                </button>
                <button
                  type="button"
                  onClick={loadDocuments}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-1 transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Làm mới</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsTourOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-400/15 hover:bg-amber-500/20 dark:hover:bg-amber-400/25 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0 whitespace-nowrap select-none"
                  title="Xem hướng dẫn nhanh hệ thống (Spotlight Tour)"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Hướng dẫn nhanh</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Filter Chips (Shopify Polaris Pattern) */}
          {(searchQuery || selectedType || selectedUnit || selectedLevel !== '' || dateFrom || dateTo) && (
            <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100 dark:border-white/[0.04]">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1">Đang lọc theo:</span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10">
                  <span>Tìm kiếm: "{searchQuery}"</span>
                  <button type="button" onClick={() => setSearchQuery('')} className="hover:text-rose-500 cursor-pointer font-bold">×</button>
                </span>
              )}
              {selectedType && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10">
                  <span>Loại: {meta.types.find((t) => String(t.type_id) === String(selectedType))?.name || selectedType}</span>
                  <button type="button" onClick={() => setSelectedType('')} className="hover:text-rose-500 cursor-pointer font-bold">×</button>
                </span>
              )}
              {selectedUnit && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10">
                  <span>Đơn vị: {selectedUnit}</span>
                  <button type="button" onClick={() => { setSelectedUnit(''); setSelectedDepartment(''); }} className="hover:text-rose-500 cursor-pointer font-bold">×</button>
                </span>
              )}
              {selectedDepartment && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10">
                  <span>Phòng ban: {tqsDepartments.find((d) => String(d.unit_id) === String(selectedDepartment))?.name || selectedDepartment}</span>
                  <button type="button" onClick={() => setSelectedDepartment('')} className="hover:text-rose-500 cursor-pointer font-bold">×</button>
                </span>
              )}
              {selectedLevel !== '' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <span>Mức bảo mật: {meta.levels.find((l) => l.level_id === Number(selectedLevel))?.name || `Cấp ${selectedLevel}`}</span>
                  <button type="button" onClick={() => setSelectedLevel('')} className="hover:text-rose-500 cursor-pointer font-bold">×</button>
                </span>
              )}
              {(dateFrom || dateTo) && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10">
                  <span>Thời gian: {dateFrom || '...'} → {dateTo || '...'}</span>
                  <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="hover:text-rose-500 cursor-pointer font-bold">×</button>
                </span>
              )}
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium ml-1 cursor-pointer"
              >
                Xóa tất cả
              </button>
              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Khớp <strong className="text-emerald-700 dark:text-emerald-400">{documents.length}</strong> văn bản
              </span>
            </div>
          )}
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
            searchQuery={searchQuery}
            onClearFilters={handleClearFilters}
            onPageChange={setCurrentPage}
            onPreview={(doc) => setPreviewDoc(doc)}
            onDownload={handleDownload}
            onCancelDownload={handleCancelDownload}
          />
        ) : (
          <DocumentTable
            documents={paginatedDocs}
            userClearanceLevel={user?.clearance_level_id || 1}
            loading={loading}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={documents.length}
            onClearFilters={handleClearFilters}
            onPageChange={setCurrentPage}
            onPreview={(doc) => setPreviewDoc(doc)}
            onDownload={handleDownload}
            onCancelDownload={handleCancelDownload}
          />
        )}
      </main>

      {/* Preview Modal */}
      <DocumentPreviewModal
        open={Boolean(previewDoc)}
        document={previewDoc}
        userClearanceLevel={user?.clearance_level_id || 1}
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
                  Quy chế an ninh dữ liệu Trường Quân sự Quân khu 7
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
                Tôi đã hiểu và cam kết tuân thủ
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Spotlight Tour for Guests */}
      <SpotlightTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
};
