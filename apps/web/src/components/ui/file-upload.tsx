'use client';

import React, { useRef, useState } from 'react';

import { FileText, Folder, TriangleAlert } from 'lucide-react';
import { formatNumber } from '../../lib/format';
export interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  selectedFile?: File | null;
  onClear?: () => void;
  uploadProgress?: number | null; // 0-100
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept,
  maxSizeMB = 10,
  label,
  helperText,
  error,
  disabled = false,
  selectedFile,
  onClear,
  uploadProgress,
  className = '',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const validateAndSelect = (file: File) => {
    setInternalError(null);
    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
      setInternalError(`حجم الملف يتجاوز الحد الأقصى المسموح (${maxSizeMB} ميجابايت)`);
      return;
    }
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelect(e.target.files[0]);
    }
  };

  const displayError = error || internalError;

  return (
    <div className={`w-full text-start ${className}`}>
      {label && <label className="block text-xs font-semibold text-fg mb-1.5">{label}</label>}

      {selectedFile ? (
        <div className="rounded-sm border border-border bg-surface p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary-subtle text-primary-subtle-fg font-bold text-sm">
              
 <FileText size={16} strokeWidth={1.75} aria-hidden />
 </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-fg truncate">{selectedFile.name}</p>
              <p className="text-xs text-fg-muted">
                {formatNumber(selectedFile.size / (1024 * 1024), 2)} ميجابايت
              </p>
              {typeof uploadProgress === 'number' && (
                <div className="mt-1.5 h-1.5 w-32 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="text-xs text-danger hover:underline p-1"
            >
              إلغاء الملف
            </button>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-primary bg-primary-subtle/40'
              : 'border-border bg-surface-sunken hover:bg-surface'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
          />
          <div className="mb-2 text-3xl"><Folder size={32} strokeWidth={1.75} aria-hidden /></div>
          <p className="text-xs font-semibold text-fg">
            اضغط لاختيار ملف أو اسحبه إلى هنا
          </p>
          <p className="text-xs text-fg-muted mt-1">
            {helperText || `الحد الأقصى ${maxSizeMB} ميجابايت`}
          </p>
        </div>
      )}

      {displayError && (
        <p className="text-xs font-medium text-danger mt-1.5 flex items-center gap-1">
          <span><TriangleAlert size={16} strokeWidth={1.75} aria-hidden /></span>
          <span>{displayError}</span>
        </p>
      )}
    </div>
  );
};

