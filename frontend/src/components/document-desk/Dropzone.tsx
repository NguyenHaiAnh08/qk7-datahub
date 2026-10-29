/* <!-- Lucian UX/UI Prompt #032 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#032 --> */
import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, Check, X, HardDrive, RefreshCw } from 'lucide-react';
import { formatFileSize } from '../../utils/formatFileSize';

export interface DropzoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  accept?: string;
  maxSizeBytes?: number;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  selectedFile,
  onFileSelect,
  accept = '.pdf,.doc,.docx,.xls,.xlsx',
  maxSizeBytes = 50 * 1024 * 1024, // 50MB
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');

  // Quản lý thanh tiến trình mượt mà khi tệp được chọn
  useEffect(() => {
    if (!selectedFile) {
      setUploadProgress(0);
      setUploadStatus('idle');
      return;
    }

    setUploadProgress(15);
    setUploadStatus('uploading');

    let current = 15;
    const interval = setInterval(() => {
      current += 20 + Math.random() * 15;
      if (current >= 100) {
        current = 100;
        setUploadProgress(100);
        setUploadStatus('done');
        clearInterval(interval);
      } else {
        setUploadProgress(current);
      }
    }, 60);

    return () => clearInterval(interval);
  }, [selectedFile]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedFile) return;
    setUploadProgress(10);
    setUploadStatus('uploading');
    let current = 10;
    const interval = setInterval(() => {
      current += 25;
      if (current >= 100) {
        current = 100;
        setUploadProgress(100);
        setUploadStatus('done');
        clearInterval(interval);
      } else {
        setUploadProgress(current);
      }
    }, 60);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > maxSizeBytes) {
        alert('File vượt quá giới hạn 50MB!');
        setUploadStatus('error');
        return;
      }
      onFileSelect(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > maxSizeBytes) {
        alert('File vượt quá giới hạn 50MB!');
        setUploadStatus('error');
        return;
      }
      onFileSelect(file);
    }
  };

  const handleZoneClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Xác định định dạng tệp và màu badge chuyên nghiệp
  const getFileBadgeInfo = (filename?: string) => {
    if (!filename) {
      return {
        ext: 'FILE',
        bg: 'bg-slate-500/15 border-slate-500/30 text-slate-700 dark:text-slate-300',
      };
    }
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      return {
        ext: 'PDF',
        bg: 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400',
      };
    }
    if (ext === 'doc' || ext === 'docx') {
      return {
        ext: 'DOCX',
        bg: 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400',
      };
    }
    if (ext === 'xls' || ext === 'xlsx') {
      return {
        ext: 'XLSX',
        bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
      };
    }
    return {
      ext: ext.toUpperCase() || 'FILE',
      bg: 'bg-slate-500/15 border-slate-500/30 text-slate-700 dark:text-slate-300',
    };
  };

  const badgeInfo = getFileBadgeInfo(selectedFile?.name);

  return (
    <div className="u032-wrapper space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Khung Drop Zone .u032 với hiệu ứng Marching Border & Floating Orb */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleZoneClick}
        className={`u032-zone flex flex-col items-center justify-center text-center transition-all ${
          selectedFile ? 'p-4 sm:p-5' : 'p-6 sm:p-7'
        } ${isDragging ? 'is-dragging' : ''}`}
      >
        {/* Lớp SVG viền đứt khúc chạy động stroke-dasharray="8 7" */}
        <svg className="u032-dash" aria-hidden="true">
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx="17"
            ry="17"
          />
        </svg>

        {/* Biểu tượng Orb mây bay nổi bật */}
        <div className="u032-orb-container mb-2">
          <div className="u032-glow" aria-hidden="true" />
          <div className="u032-orb">
            <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          </div>
        </div>

        {/* Nhãn chỉ dẫn theo chuẩn Trường Quân Sự Quân Khu 7 */}
        <div className="relative z-2 text-xs text-slate-700 dark:text-slate-300">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {selectedFile ? 'Nhấn để thay đổi tệp' : 'Nhấn để chọn tệp'}
          </span>{' '}
          {selectedFile ? 'hoặc kéo thả tệp mới vào đây' : 'hoặc kéo thả vào đây'}
        </div>
        <p className="relative z-2 text-[11px] text-slate-400 dark:text-slate-500 mt-1">
          Hỗ trợ PDF, DOCX, XLSX (Dung lượng tối đa 50MB)
        </p>
      </div>

      {/* Danh sách hiển thị tiến trình tải tệp .u032-list */}
      {selectedFile && (
        <div className="u032-list">
          <div className="u032-item">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                {/* Format Badge */}
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center font-bold text-[10px] sm:text-[11px] tracking-wide shrink-0 shadow-xs ${badgeInfo.bg}`}
                >
                  {badgeInfo.ext}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-[320px]">
                      {selectedFile.name}
                    </p>
                    {uploadStatus === 'done' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" /> Sẵn sàng
                      </span>
                    )}
                    {uploadStatus === 'uploading' && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium shrink-0">
                        {Math.round(uploadProgress)}%
                      </span>
                    )}
                    {uploadStatus === 'error' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0">
                        Lỗi đường truyền
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <HardDrive className="w-3 h-3 shrink-0" />
                    <span>{formatFileSize(selectedFile.size)}</span>
                    <span>•</span>
                    <span className="font-mono uppercase">{badgeInfo.ext}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {uploadStatus === 'error' && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition cursor-pointer"
                    title="Thử lại"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Thử lại</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileSelect(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Gỡ bỏ tệp"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thanh tiến trình Progress Bar */}
            <div className="u032-progress-track">
              <div
                className={`u032-progress-bar ${uploadStatus === 'error' ? 'is-error' : ''}`}
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

