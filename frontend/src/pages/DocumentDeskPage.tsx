import React, { useState, useEffect, useMemo } from 'react';
import { Plus, RotateCw, FileCheck } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Toast, ToastState, toast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { DocumentFilters } from '../components/document-desk/DocumentFilters';
import { DocumentTable } from '../components/document-desk/DocumentTable';
import { DocumentUploadModal } from '../components/document-desk/DocumentUploadModal';
import { DocumentPreviewModal } from '../components/document-desk/DocumentPreviewModal';
import { documentsApi } from '../services/documentsApi';
import { dashboardApi } from '../services/dashboardApi';
import { useAuth } from '../hooks/useAuth';
import { DocumentItem, MetaData, DocumentType, Unit, SecurityLevel } from '../types';

const ITEMS_PER_PAGE = 8;

export const DocumentDeskPage: React.FC = () => {
  const { user } = useAuth();
  const canUpload = (user?.roles || []).includes('ROL-01') || (user?.roles || []).includes('ROL-04');

  // Metadata
  const [meta, setMeta] = useState<MetaData>({ types: [], units: [], levels: [] });

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<number>(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Documents State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<DocumentItem | null>(null);

  // Toast Dispatcher (Global AnimatedToast)
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  // Load Metadata
  useEffect(() => {
    dashboardApi
      .getMeta()
      .then((res) => {
        setMeta(res);
      })
      .catch((err) => console.error('[loadMeta]', err));
  }, []);

  // Load Documents
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await documentsApi.getDocuments({
        q: searchQuery || undefined,
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

  // Debounced search & filter reload
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
    setSelectedLevel(0);
    setDateFrom('');
    setDateTo('');
    showToast('Đã làm mới các bộ lọc', 'info');
  };

  // Save Document (Create or Edit)
  const handleSaveDocument = async (formData: FormData, isEdit: boolean) => {
    if (isEdit && editingDoc) {
      await documentsApi.updateDocument(editingDoc.file_id, formData);
    } else {
      await documentsApi.uploadDocument(formData);
    }
    await loadDocuments();
  };

  // Delete Document
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmDoc) return;
    try {
      await documentsApi.deleteDocument(deleteConfirmDoc.file_id);
      toast.success(`Đã xóa văn bản ${deleteConfirmDoc.document_code} khỏi hệ thống văn thư.`, {
        title: 'XÓA TÀI LIỆU THÀNH CÔNG',
        badge: deleteConfirmDoc.document_code,
      });
      setDeleteConfirmDoc(null);
      await loadDocuments();
    } catch (err: any) {
      toast.error('Lỗi xóa văn bản: ' + err.message, {
        title: 'LỖI THAO TÁC',
        badge: 'DELETE-ERR',
      });
    }
  };

  // Download Handler
  const handleDownload = async (doc: DocumentItem) => {
    const userClearance = user?.clearance_level_id || 1;
    const docLevel = doc.security_level_id || 1;

    // Quy định bảo mật: Từ Cấp 3 trở đi chỉ duy nhất cho phép xem, không được tải về
    if (docLevel >= 3) {
      toast.securityAlert(
        'Tài liệu từ Cấp 3 trở lên chỉ duy nhất cho phép xem trực tiếp có xác thực vân tay 2FA, tuyệt đối không được phép tải về máy.',
        { title: 'QUY ĐỊNH BẢO MẬT VĂN THƯ', badge: 'LEVEL-3+' }
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
      toast.info(`Đang tải văn bản ${doc.document_code}...`, {
        title: 'ĐANG XỬ LÝ TỆP',
        badge: 'STREAMING',
        duration: 2500,
      });
      await documentsApi.downloadDocument(doc.file_id, doc.original_name || `${doc.document_code}.pdf`);
      toast.success(`Đã tải xuống thành công văn bản ${doc.document_code}`, {
        title: 'TẢI TỆP HOÀN TẤT',
        badge: 'PDF-READY',
      });
    } catch (err: any) {
      toast.error('Lỗi tải văn bản: ' + (err.message || 'Không có quyền truy cập'), {
        title: 'THẤT BẠI',
        badge: 'DOWNLOAD-ERR',
      });
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
        activeNav="desk"
        title="Trường Quân Sự Quân Khu 7"
        subtitle="Trung tâm dữ liệu số"
      />

      {/* Main Container */}
      <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-6 xl:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Top Action & Title Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
              <FileCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <span>Trung tâm văn bản</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tiếp nhận, xử lý, phân loại và lưu trữ văn bản quân sự tuyệt mật & công khai
            </p>
          </div>

           {canUpload && (
          <button
            onClick={() => {
              setEditingDoc(null);
              setUploadModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#166534] hover:bg-[#15803d] text-white font-semibold rounded-lg text-xs flex items-center gap-2 border border-emerald-600/40 transition-colors cursor-pointer shrink-0 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Tiếp Nhận Văn Bản Mới</span>
          </button>
          )}
        </div>

        {/* Filters */}
        <DocumentFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          selectedUnit={selectedUnit}
          onUnitChange={setSelectedUnit}
          selectedLevel={selectedLevel}
          onLevelChange={setSelectedLevel}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          types={meta.types}
          units={meta.units}
          levels={meta.levels}
          onReset={handleResetFilters}
          onRefresh={loadDocuments}
        />

        {/* Document Table */}
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
          onEdit={(doc) => {
            setEditingDoc(doc);
            setUploadModalOpen(true);
          }}
          onDelete={(doc) => setDeleteConfirmDoc(doc)}
        />
      </main>

      {/* Upload & Edit Modal */}
      <DocumentUploadModal
        open={uploadModalOpen}
        document={editingDoc}
        types={meta.types}
        units={meta.units}
        levels={meta.levels}
        onClose={() => {
          setUploadModalOpen(false);
          setEditingDoc(null);
        }}
        onSave={handleSaveDocument}
        onToast={showToast}
      />

      {/* Preview Modal */}
      <DocumentPreviewModal
        open={Boolean(previewDoc)}
        document={previewDoc}
        userClearanceLevel={user?.clearance_level_id || 1}
        onClose={() => setPreviewDoc(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteConfirmDoc)}
        title="Xác Nhận Xóa Văn Bản"
        message={`Bạn có chắc chắn muốn xóa văn bản ${deleteConfirmDoc?.document_code} (${deleteConfirmDoc?.title}) khỏi hệ thống? Thao tác này không thể hoàn tác.`}
        confirmText="Xác nhận xóa"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmDoc(null)}
      />
    </div>
  );
};
