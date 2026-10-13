import React, { useRef, useState } from 'react';
import { UploadCloud, FileCheck, X, HardDrive } from 'lucide-react';
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
  maxSizeBytes = 50 * 1024 * 1024 // 50MB
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
        return;
      }
      onFileSelect(file);
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-2 ${
            isDragging
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500/60 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/70'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Nhấn để chọn tệp
            </span>{' '}
            hoặc kéo thả vào đây
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Hỗ trợ PDF, DOCX, XLSX (Dung lượng tối đa 50MB)
          </p>
        </div>
      ) : (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/80 border border-emerald-500/40 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {selectedFile.name}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                <HardDrive className="w-3 h-3" />
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFileSelect(null);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title="Gỡ bỏ tệp"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
