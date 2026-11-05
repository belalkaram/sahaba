'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { DataState } from '../../../../components/ui/data-state';
import { UsersIcon, CheckCircleIcon } from '../../../../components/icons';
import { adminApi, type StudentImportRecord } from '../../../../lib/admin-api';

import { Download, FileText, Upload } from 'lucide-react';
import { IconBack } from '../../../../components/icons/directional';
import { formatDateTime, formatNumber } from '../../../../lib/format';
export default function StudentImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentImportResult, setCurrentImportResult] = useState<StudentImportRecord | null>(null);

  // Past imports history
  const [importsHistory, setImportsHistory] = useState<StudentImportRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const list = await adminApi.getImports();
      setImportsHistory(list);
    } catch {
      // Ignored for non-critical history
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadError('يرجى اختيار ملف CSV أولاً.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setCurrentImportResult(null);

    try {
      let result = await adminApi.importStudents(file);
      setCurrentImportResult(result);
      // The import runs on the queue: follow it until it finishes.
      while (result.status === 'queued' || result.status === 'processing') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        result = await adminApi.getImport(result.id);
        setCurrentImportResult(result);
      }
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadHistory();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'فشل رفع ومعالجة ملف الاستيراد.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin/users" className="text-xs text-secondary hover:text-fg">
            
 <IconBack size={16} /> العودة لإدارة المستخدمين
 </Link>
        </div>
        <h1 className="text-2xl font-bold text-fg tracking-tight flex items-center gap-2">
          <UsersIcon size={24} className="text-primary" />
          الاستيراد الجماعي للطلاب (Bulk CSV Import)
        </h1>
        <p className="text-sm text-secondary mt-1">
          رفع ومعالجة ملفات CSV لإضافة دفعات كبيرة من الطلاب مع توليد أكوادهم وربط أولياء أمورهم تلقائياً.
        </p>
      </div>

      {/* CSV Template & Guidelines Card */}
      <Card className="p-5 border-primary/20 bg-primary/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl"><FileText size={24} strokeWidth={1.75} aria-hidden /></span>
            <h2 className="text-sm font-bold text-fg">متطلبات ملف الـ CSV وتنسيق الأعمدة</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              const sampleCsv =
                'name,phone,email,grade_level,parent_name,parent_phone\n' +
                'أحمد محمود,01011112222,ahmed@example.com,الصف الأول الثانوي,محمود علي,01099998888\n' +
                'سارة إبراهيم,01122223333,,الصف الثاني الثانوي,إبراهيم حسن,01233334444';
              const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'students_sample.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-3 py-1.5 bg-card border border-border hover:bg-background text-primary rounded-md text-xs font-medium transition-colors"
          >
            
 <Download size={16} strokeWidth={1.75} aria-hidden /> تحميل ملف نموذج تجريبي (Sample CSV)
 </button>
        </div>

        <p className="text-xs text-secondary leading-relaxed mb-3">
          يجب أن يحتوي السطر الأول على ترويسات الأعمدة التالية بالضبط باللغة الإنجليزية:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs font-mono">
          <div className="p-2 bg-background rounded-sm border border-border">
            <span className="text-fg font-bold block">name *</span>
            <span className="text-secondary text-xs">اسم الطالب</span>
          </div>
          <div className="p-2 bg-background rounded-sm border border-border">
            <span className="text-fg font-bold block">phone</span>
            <span className="text-secondary text-xs">رقم هاتف الطالب</span>
          </div>
          <div className="p-2 bg-background rounded-sm border border-border">
            <span className="text-fg font-bold block">email</span>
            <span className="text-secondary text-xs">البريد الإلكتروني</span>
          </div>
          <div className="p-2 bg-background rounded-sm border border-border">
            <span className="text-fg font-bold block">grade_level</span>
            <span className="text-secondary text-xs">الصف الدراسي</span>
          </div>
          <div className="p-2 bg-background rounded-sm border border-border">
            <span className="text-fg font-bold block">parent_name *</span>
            <span className="text-secondary text-xs">اسم ولي الأمر (إلزامي)</span>
          </div>
          <div className="p-2 bg-background rounded-sm border border-border">
            <span className="text-fg font-bold block">parent_phone *</span>
            <span className="text-secondary text-xs">هاتف ولي الأمر (إلزامي)</span>
          </div>
        </div>
      </Card>

      {/* Upload Box */}
      <Card className="p-6">
        <form onSubmit={handleUpload} className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary rounded-xl p-8 text-center cursor-pointer transition-colors bg-background/50"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="text-4xl mb-3"><Upload size={32} strokeWidth={1.75} aria-hidden /></div>
            <div className="text-sm font-bold text-fg mb-1">
              {file ? file.name : 'انقر لاختيار ملف الـ CSV أو اسحبه هنا'}
            </div>
            <p className="text-xs text-secondary">
              {file
                ? `حجم الملف: ${formatNumber(file.size / 1024, 1)} كيلوبايت`
                : 'يدعم صيغة CSV ذات الفواصل القياسية أو علامات الفاصلة المنقوطة'}
            </p>
          </div>

          {uploadError && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-danger text-xs text-center">
              {uploadError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-fg transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
            >
              {uploading ? 'جارٍ رفع ومعالجة الملف...' : 'بدء عملية الاستيراد الآن'}
            </button>
          </div>
        </form>
      </Card>

      {/* Real-time Import Results */}
      {currentImportResult && (
        <Card className="p-6 space-y-4 border-primary/30">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <CheckCircleIcon size={20} />
              <span>نتائج معالجة الملف ({currentImportResult.file_name})</span>
            </div>
            <Badge variant={currentImportResult.status === 'completed' ? 'success' : 'danger'}>
              {currentImportResult.status === 'completed' ? 'اكتملت المعالجة' : 'فشل الاستيراد'}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-background rounded-md border border-border">
              <span className="text-xs text-secondary block">إجمالي الصفوف</span>
              <span className="text-xl font-bold text-fg mt-1 block">
                {currentImportResult.total_rows}
              </span>
            </div>
            <div className="p-3 bg-primary/10 rounded-md border border-primary/20">
              <span className="text-xs text-primary block">تم استيرادهم بنجاح</span>
              <span className="text-xl font-bold text-primary mt-1 block">
                {currentImportResult.imported_count}
              </span>
            </div>
            <div className="p-3 bg-danger/10 rounded-md border border-danger/20">
              <span className="text-xs text-danger block">صفوف غير مقبولة (أخطاء)</span>
              <span className="text-xl font-bold text-danger mt-1 block">
                {currentImportResult.failed_count}
              </span>
            </div>
          </div>

          {/* Detailed Failures if any */}
          {currentImportResult.summary_log?.failed &&
            currentImportResult.summary_log.failed.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold text-danger">
                  تفاصيل الأخطاء والصفوف غير المقبولة:
                </h3>
                <div className="max-h-56 overflow-y-auto space-y-1.5">
                  {currentImportResult.summary_log.failed.map((f, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-sm bg-danger/10 border border-danger/20 text-xs flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-fg">السطر {f.row}: </span>
                        <span className="text-danger">{f.error}</span>
                      </div>
                      <span className="text-xs text-secondary font-mono">
                        {f.raw?.name || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </Card>
      )}

      {/* Past Imports History */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-fg mb-4">سجل عمليات الاستيراد السابقة</h2>
        {loadingHistory ? (
          <DataState state="loading" message="جارٍ تحميل السجل..." />
        ) : importsHistory.length === 0 ? (
          <div className="py-8 text-center text-secondary text-xs">
            لا توجد عمليات استيراد سابقة مسجلة.
          </div>
        ) : (
          <div tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border text-secondary">
                <tr>
                  <th className="pb-3 px-3">اسم الملف</th>
                  <th className="pb-3 px-3">التاريخ والوقت</th>
                  <th className="pb-3 px-3">إجمالي الصفوف</th>
                  <th className="pb-3 px-3">المستورد بنجاح</th>
                  <th className="pb-3 px-3">الأخطاء</th>
                  <th className="pb-3 px-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {importsHistory.map((imp) => (
                  <tr key={imp.id} className="hover:bg-card/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-fg">{imp.file_name}</td>
                    <td className="py-3 px-3 text-secondary font-mono text-xs" dir="ltr">
                      {formatDateTime(imp.created_at)}
                    </td>
                    <td className="py-3 px-3 text-fg">{imp.total_rows}</td>
                    <td className="py-3 px-3 text-primary font-semibold">{imp.imported_count}</td>
                    <td className="py-3 px-3 text-danger font-semibold">{imp.failed_count}</td>
                    <td className="py-3 px-3">
                      {imp.status === 'completed' ? (
                        <Badge variant="success">مكتمل</Badge>
                      ) : (
                        <Badge variant="danger">فشل</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

