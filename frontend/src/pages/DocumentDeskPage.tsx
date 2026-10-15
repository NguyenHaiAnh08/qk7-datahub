import React, { useState, useEffect, useMemo } from 'react';
import { Plus, RotateCw, FileCheck } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Toast, ToastState } from '../components/common/Toast';
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

  // Metadata
  const [meta, setMeta] = useState<MetaData>({ types: [], units: [], levels: [] });

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<number>(user?.clearance_level_id || 5);
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
    setSelectedLevel(user?.clearance_level_id || 5);
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
      showToast(`Đã xóa văn bản ${deleteConfirmDoc.document_code} thành công`);
      setDeleteConfirmDoc(null);
      await loadDocuments();
    } catch (err: any) {
      showToast('Lỗi xóa văn bản: ' + err.message, 'error');
    }
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
        activeNav="desk"
        title="QK7 DATAHUB"
        subtitle="Bàn Làm Việc Văn Thư — Quản Lý Lưu Trữ Văn Bản"
      />

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Top Action & Title Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
              <FileCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <span>Bàn Làm Việc Văn Thư Quân Khu</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tiếp nhận, xử lý, phân loại và lưu trữ văn bản quân sự tuyệt mật & công khai
            </p>
          </div>

          <button
            onClick={() => {
              setEditingDoc(null);
              setUploadModalOpen(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tiếp Nhận Văn Bản Mới</span>
          </button>
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
          userClearanceLevel={user?.clearance_level_id || 5}
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

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
    </div>
  );
};
