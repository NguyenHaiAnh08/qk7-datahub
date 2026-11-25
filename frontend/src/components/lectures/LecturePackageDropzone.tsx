/* QK7 DataHub · Tactical Lecture Package Dropzone (SCORM / HTML5 ZIP) */
import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, Check, X, HardDrive, RefreshCw, Layers, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { formatFileSize } from '../../utils/formatFileSize';
import { ContentType } from '../../types/lecture';

export interface LecturePackageDropzoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  contentType: ContentType;
  maxSizeBytes?: number;
}

export const LecturePackageDropzone: React.FC<LecturePackageDropzoneProps> = ({
  selectedFile,
  onFileSelect,
  contentType,
  maxSizeBytes = 200 * 1024 * 1024, // 200MB cho gói SCORM/HTML5
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hiệu ứng tiến trình nạp tệp mượt mà khi tệp được chọn
  useEffect(() => {
    if (!selectedFile) {
      setUploadProgress(0);
      setUploadStatus('idle');
      setErrorMsg(null);
      return;
    }

    setUploadProgress(15);
    setUploadStatus('uploading');
    setErrorMsg(null);

    let current = 15;
    const interval = setInterval(() => {
      current += 20 + Math.random() * 20;
      if (current >= 100) {
        current = 100;
        setUploadProgress(100);
        setUploadStatus('done');
        clearInterval(interval);
      } else {
        setUploadProgress(current);
      }
    }, 50);

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
    }, 50);
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
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelect(e.target.files[0]);
    }
  };

  const validateAndSelect = (file: File) => {
    if (contentType === 'PDF') {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setErrorMsg('Định dạng tệp không hợp lệ! Vui lòng chọn tệp tài liệu .pdf');
        setUploadStatus('error');
        return;
      }
    } else {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setErrorMsg('Định dạng tệp không hợp lệ! Vui lòng chọn tệp .zip nén');
        setUploadStatus('error');
        return;
      }
    }
    if (file.size > maxSizeBytes) {
      setErrorMsg(`Tệp vượt quá giới hạn ${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB!`);
      setUploadStatus('error');
      return;
    }
    setErrorMsg(null);
    onFileSelect(file);
  };

  const handleZoneClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const getFormatBadge = () => {
    if (contentType === 'PDF') {
      return {
        label: 'PDF',
        icon: <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
        badge: 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-400',
        hint: 'Giáo án điện tử, tài liệu bài giảng số hóa định dạng PDF (tối đa 100MB)',
      };
    }
    if (contentType === 'SCORM') {
      return {
        label: 'SCORM',
        icon: <Layers className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
        badge: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400',
        hint: 'Tương thích gói SCORM 1.2 / 2004 (ActivePresenter / Storyline)',
      };
    }
    return {
      label: 'HTML5',
      icon: <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
      hint: 'Chứa tệp index.html và các tài nguyên đa phương tiện',
    };
  };

  const fmt = getFormatBadge();

  return (
    <div className="u032-wrapper space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={contentType === 'PDF' ? '.pdf,application/pdf' : '.zip,application/zip,application/x-zip-compressed'}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Khung Drop Zone .u032 với hiệu ứng Marching Border & Floating Orb */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleZoneClick}
        className={`u032-zone flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
          selectedFile ? 'p-4 sm:p-5' : 'p-6 sm:p-8'
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
            <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2] text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        {/* Nhãn chỉ dẫn theo chuẩn Trường Quân Sự Quân Khu 7 */}
        <div className="relative z-2 text-xs text-slate-700 dark:text-slate-300">
          <span className="font-bold text-emerald-700 dark:text-emerald-400">
            {selectedFile
              ? 'Nhấn để thay đổi tệp'
              : contentType === 'PDF'
              ? 'Nhấn để chọn tệp tài liệu bài giảng (.pdf)'
              : 'Nhấn để chọn tệp gói bài giảng (.zip)'}
          </span>{' '}
          {selectedFile
            ? `hoặc kéo thả tệp ${contentType === 'PDF' ? '.pdf' : '.zip'} mới vào đây`
            : `hoặc kéo thả tệp ${contentType === 'PDF' ? '.pdf' : '.zip'} vào đây`}
        </div>
        <p className="relative z-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
          {fmt.hint} (Dung lượng tối đa 200MB)
        </p>
      </div>

      {/* Lỗi định dạng nếu có */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Danh sách hiển thị tiến trình tải tệp .u032-list */}
      {selectedFile && (
        <div className="u032-list">
          <div className="u032-item">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                {/* Format Icon Box */}
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${fmt.badge}`}
                >
                  {fmt.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-[320px]">
                      {selectedFile.name}
                    </p>
                    {uploadStatus === 'done' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" /> Gói hợp lệ
                      </span>
                    )}
                    {uploadStatus === 'uploading' && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium shrink-0">
                        {Math.round(uploadProgress)}%
                      </span>
                    )}
                    {uploadStatus === 'error' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0">
                        Lỗi tệp
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono tabular-nums">
                    <HardDrive className="w-3 h-3 shrink-0" />
                    <span>{formatFileSize(selectedFile.size)}</span>
                    <span>•</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
                      {contentType}
                    </span>
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                  title="Gỡ bỏ tệp"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thanh tiến trình Progress Bar */}
            <div className="u032-progress-track mt-2">
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

export default LecturePackageDropzone;

