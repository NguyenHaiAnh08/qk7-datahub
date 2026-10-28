import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, RotateCw, Eraser, Calendar, Building,
  LayoutGrid, List, BarChart2, ChevronDown, Shield, FileText,
} from 'lucide-react';
import { Header } from '../components/common/Header';
import { toast } from '../components/common/Toast';
import { UnitOverviewStrip } from '../components/portal/UnitOverviewStrip';
import { DistributionChart } from '../components/dashboard/DistributionChart';
import { PortalDocumentList } from '../components/portal/PortalDocumentList';
import { DocumentTable } from '../components/document-desk/DocumentTable';
import { DocumentPreviewModal } from '../components/document-desk/DocumentPreviewModal';
import { DateRangePicker } from '../components/common/DateRangePicker';
import { documentsApi } from '../services/documentsApi';
import { dashboardApi } from '../services/dashboardApi';
import { documentService, MyUnitDocumentResponse } from '../services/documentService';
import { useAuth } from '../hooks/useAuth';
import { DocumentItem, MetaData } from '../types';

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
  const [allUnitDocuments, setAllUnitDocuments] = useState<DocumentItem[]>([]);
  const [showStats, setShowStats] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  const handleRefresh = async () => {
    setRefreshKey((prev) => prev + 1);
    if (selectedUnitId) {
      documentService
        .getMyUnitDocuments({ unit_id: selectedUnitId })
        .then((res) => {
          setAllUnitDocuments(res.items || []);
        })
        .catch(() => {});
    }
    await loadDocuments();
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  useEffect(() => {
    dashboardApi.getMeta().then(setMeta).catch((err) => console.error('[meta]', err));
  }, []);


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
      // Cập nhật allUnitDocuments khi không có bộ lọc phụ hoặc khi chưa có dữ liệu
      const isFiltered = Boolean(searchQuery || selectedType || selectedLevel !== '' || dateFrom || dateTo);
      if (!isFiltered || allUnitDocuments.length === 0) {
        setAllUnitDocuments(res.items || []);
      }
      setCurrentPage(1);
    } catch (err: any) {
      showToast('Lỗi tải tài liệu: ' + (err.message || 'Không xác định'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Đồng bộ nạp toàn bộ tài liệu của đơn vị để số liệu thẻ tổng quan KPI luôn chính xác
  useEffect(() => {
    if (selectedUnitId) {
      documentService
        .getMyUnitDocuments({ unit_id: selectedUnitId })
        .then((res) => {
          setAllUnitDocuments(res.items || []);
        })
        .catch(() => {});
    }
  }, [selectedUnitId]);

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
    if (user?.unit_id) {
      setSelectedUnitId(user.unit_id);
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    const userClearance = user?.clearance_level_id || 1;
    const docLevel = doc.security_level_id || 1;
    if (docLevel >= 3) {
      toast.securityAlert(
        'Tài liệu từ Cấp 3 trở lên chỉ duy nhất cho phép xem trực tiếp có xác thực vân tay 2FA, tuyệt đối không được phép tải về máy.',
        { title: 'QUY ĐỊNH BẢO MẬT ĐƠN VỊ', badge: 'LEVEL-3+' }
      );
      return;
    }
    if (docLevel > userClearance) {
      toast.securityAlert(
        `Cấp độ bảo mật hiện tại của đồng chí (Cấp ${userClearance}) không đủ để tải văn bản Cấp ${docLevel}.`,
        { title: 'TỪ CHỐI TRUY CẬP', badge: 'CLEARANCE-DENIED' }
      );
      return;
    }
    try {
      await documentsApi.downloadDocument(doc.file_id, doc.original_name || `${doc.document_code}.pdf`);
      toast.success(`Đã tải xuống thành công văn bản ${doc.document_code}`, {
        title: 'TẢI TỆP HOÀN TẤT',
        badge: 'PDF-READY',
      });
    } catch (err: any) {
      toast.error('Lỗi tải văn bản: ' + err.message, {
        title: 'LỖI TẢI VĂN BẢN',
        badge: 'DOWNLOAD-ERR',
      });
    }
  };

  const totalPages = Math.max(1, Math.ceil(documents.length / ITEMS_PER_PAGE));
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return documents.slice(start, start + ITEMS_PER_PAGE);
  }, [documents, currentPage]);

  const userClearance = user?.clearance_level_id || 1;
  const userLevelObj = meta.levels.find((l) => l.level_id === userClearance);
  const userLevelName =
    userLevelObj?.name ||
    (userClearance === 1
      ? 'Công khai'
      : userClearance === 2
      ? 'Nội bộ'
      : userClearance === 3
      ? 'Mật'
      : userClearance === 4
      ? 'Tối mật'
      : 'Tuyệt mật');

  // Dữ liệu văn bản dùng tính toán thống kê (ưu tiên toàn bộ văn bản của đơn vị)
  const targetDocs = allUnitDocuments.length > 0 ? allUnitDocuments : documents;

  // Phân bố theo Mức Bảo Mật (5 cấp độ chuẩn theo quy chuẩn quân sự)
  const levelDistribution = useMemo(() => {
    const defaultLevels = [
      { id: 1, label: 'Công khai' },
      { id: 2, label: 'Nội bộ' },
      { id: 3, label: 'Mật' },
      { id: 4, label: 'Tối mật' },
      { id: 5, label: 'Tuyệt mật' },
    ];
    const sourceLevels =
      meta.levels.length > 0
        ? meta.levels.map((l) => ({ id: l.level_id, label: l.name }))
        : defaultLevels;

    return sourceLevels.map((lvl) => {
      const count = targetDocs.filter(
        (d) => (d.security_level_id || 1) === lvl.id
      ).length;
      return {
        id: lvl.id,
        label: lvl.label,
        count,
      };
    });
  }, [meta.levels, targetDocs]);

  // Phân bố theo Thể Loại Văn Bản
  const typeDistribution = useMemo(() => {
    const defaultTypes = [
      { id: 'BC', label: 'Báo cáo' },
      { id: 'KH', label: 'Kế hoạch' },
      { id: 'QD', label: 'Quyết định' },
      { id: 'CT', label: 'Chỉ thị' },
      { id: 'CV', label: 'Công văn' },
      { id: 'TB', label: 'Thông báo' },
      { id: 'BB', label: 'Biên bản' },
    ];
    const sourceTypes =
      meta.types.length > 0
        ? meta.types.map((t) => ({ id: t.type_id, label: t.name }))
        : defaultTypes;

    return sourceTypes.map((t) => {
      const count = targetDocs.filter(
        (d) =>
          d.doc_type_id === t.id ||
          d.type_id === t.id ||
          (d.doc_type_name && d.doc_type_name.toLowerCase() === t.label.toLowerCase()) ||
          (d.type_name && d.type_name.toLowerCase() === t.label.toLowerCase())
      ).length;
      return {
        id: t.id,
        label: t.label,
        count,
      };
    });
  }, [meta.types, targetDocs]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header
        activeNav="myunit"
        title="Trường Quân Sự Quân Khu 7"
        subtitle="Trung tâm dữ liệu số"
      />

      <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-6 xl:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-600/10 dark:bg-emerald-500/10 border border-emerald-600/25 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
                <span>Trường Quân Sự Quân Khu 7</span>
                <span className="text-slate-400 dark:text-slate-600">›</span>
                <span className="text-slate-600 dark:text-slate-300">Đơn vị trực thuộc</span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {currentUnit?.name || 'Trường Quân sự Quân khu 7'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Hệ thống hiển thị theo đơn vị của bạn.
              </p>
            </div>
          </div>

          {/* Toggle Thống kê Đơn vị */}
          <button
            type="button"
            onClick={() => setShowStats((prev) => !prev)}
            className="btn-tactile px-3.5 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0 self-start sm:self-auto group"
            title={showStats ? 'Thu gọn khung thông số tổng quan' : 'Mở rộng khung thông số tổng quan'}
          >
            <BarChart2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>{showStats ? 'Ẩn thống kê' : 'Hiện thống kê'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showStats ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Khung Thông Số Tổng Quan & Phân Bố Đơn Vị */}
        <AnimatePresence initial={false}>
          {showStats && (
            <motion.div
              key="unit-kpi-strip"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              className="overflow-hidden space-y-3.5"
            >
              <UnitOverviewStrip
                documents={documents}
                allUnitDocuments={allUnitDocuments}
                userClearanceLevel={userClearance}
                userLevelName={userLevelName}
                userName={user?.full_name}
                selectedLevel={selectedLevel}
                onSelectLevel={(lv) => setSelectedLevel(lv)}
                onResetFilters={handleResetFilters}
                onCardClickToast={(msg) => toast.info(msg, { title: 'THÔNG BÁO ĐƠN VỊ' })}
                refreshKey={refreshKey}
              />

              {/* 2 Biểu Đồ Phân Bố: Mức Bảo Mật & Thể Loại Văn Bản */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                <DistributionChart
                  title="Phân Bố Tài Liệu Theo Mức Bảo Mật"
                  icon={<Shield className="w-4 h-4 text-amber-500" />}
                  barColor="amber"
                  selectedId={selectedLevel !== '' ? Number(selectedLevel) : undefined}
                  onItemClick={(item) => {
                    const lvId = Number(item.id);
                    if (selectedLevel === lvId) {
                      setSelectedLevel('');
                    } else {
                      setSelectedLevel(lvId);
                    }
                  }}
                  items={levelDistribution}
                  refreshKey={refreshKey}
                />
                <DistributionChart
                  title="Phân Bố Tài Liệu Theo Thể Loại Văn Bản"
                  icon={<FileText className="w-4 h-4 text-emerald-500" />}
                  barColor="emerald"
                  selectedId={selectedType || undefined}
                  onItemClick={(item) => {
                    const tId = String(item.id);
                    if (selectedType === tId) {
                      setSelectedType('');
                    } else {
                      setSelectedType(tId);
                    }
                  }}
                  items={typeDistribution}
                  refreshKey={refreshKey}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter */}
        <div className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/[0.08] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Đơn vị
              </label>
              <input
                type="text"
                readOnly
                value={currentUnit?.name || user?.unit_name || 'Trường Quân sự Quân khu 7'}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-default select-none truncate"
                title={currentUnit?.name || user?.unit_name || 'Trường Quân sự Quân khu 7'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Tìm kiếm
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Số hiệu, trích yếu..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Loại văn bản
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 [&>option]:bg-white [&>option]:text-slate-800 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
              >
                <option value="">Tất cả thể loại</option>
                {meta.types.map((t) => (
                  <option key={t.type_id} value={t.type_id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Mức bảo mật
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 [&>option]:bg-white [&>option]:text-slate-800 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
              >
                <option value="">Tất cả cấp độ</option>
                {meta.levels.map((l) => (
                  <option key={l.level_id} value={l.level_id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center space-x-2 text-xs">
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

            <div className="flex items-center space-x-2 justify-end">
              <div className="p-0.5 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  title="Dạng lưới"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  title="Dạng bảng"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-300/80 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* Active Filter Chips (Shopify Polaris Pattern) */}
          {(searchQuery || selectedType || selectedLevel !== '' || dateFrom || dateTo) && (
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

        {viewMode === 'grid' ? (
          <PortalDocumentList
            documents={paginatedDocs}
            userClearanceLevel={user?.clearance_level_id || 1}
            loading={loading}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={documents.length}
            searchQuery={searchQuery}
            onClearFilters={handleResetFilters}
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
            searchQuery={searchQuery}
            onClearFilters={handleResetFilters}
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
    </div>
  );
};

export default MyUnitPage;