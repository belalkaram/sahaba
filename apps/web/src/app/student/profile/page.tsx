'use client';

/**
 * R7B — Student Profile & Device Binding Management Page
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/auth-context';
import { credentialsApi, CredentialItem } from '../../../lib/credentials-api';
import { PageHeader } from '../../../components/ui/page-header';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Avatar } from '../../../components/ui/avatar';
import { Skeleton } from '../../../components/ui/skeleton';
import { SmartphoneIcon, ShieldIcon, CheckCircleIcon } from '../../../components/icons';

import { X } from 'lucide-react';
import { formatDate } from '../../../lib/format';
const REPLACEMENT_PRESETS = [
  'شراء جهاز جديد وتغيير الجهاز السابق',
  'عطل أو كسر في شاشة الجهاز الحالي',
  'تحديث نظام التشغيل وتغير البصمة الرقمية للجهاز',
  'فقدان أو سرقة الجهاز',
];

export default function StudentProfilePage() {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Request modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [targetCredId, setTargetCredId] = useState<string>('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [replaceReason, setReplaceReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadCredentials = async () => {
      if (!user?.student?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await credentialsApi.getStudentCredentials(user.student.id);
        setCredentials(data);
      } catch {
        // Handled silently or empty state
      } finally {
        setLoading(false);
      }
    };

    loadCredentials();
  }, [user]);

  const activeCred = credentials.find((c) => c.status === 'active') || credentials[0];
  const activeBinding = activeCred?.device_binding;

  const handleOpenRequest = (credId: string) => {
    setTargetCredId(credId);
    setNewDeviceName('');
    setReplaceReason('');
    setIsRequestModalOpen(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCredId || !replaceReason.trim()) return;

    setIsSubmitting(true);
    try {
      await credentialsApi.requestReplacement(targetCredId, {
        reason: replaceReason.trim(),
        newDeviceName: newDeviceName.trim() || undefined,
      });
      setFeedback({
        type: 'success',
        text: 'تم تقديم طلب استبدال الجهاز إلى إدارة المؤسسة بنجاح وسيتم إشعارك فور الاعتماد.',
      });
      setIsRequestModalOpen(false);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'حدث خطأ أثناء تقديم الطلب. يرجى المحاولة لاحقاً.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const studentName = user?.name || user?.email || 'طالب';
  const studentCode = user?.student?.student_code || '---';
  const gradeLevel = user?.student?.grade_level || 'غير محدد';

  return (
    <div className="space-y-6 text-start max-w-5xl mx-auto">
      <PageHeader
        title="الملف الشخصي وإدارة الأجهزة المقترنة"
        description="بيانات الطالب الأكاديمية وحالة اقتران الجهاز الرقمي المرخص للدخول للمنصة."
        breadcrumbs={[
          { label: 'الرئيسية', href: '/student/dashboard' },
          { label: 'الملف الشخصي والأجهزة' },
        ]}
      />

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-success-subtle text-success-subtle-fg border border-success/30'
              : 'bg-danger-subtle text-danger-subtle-fg border border-danger/30'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold px-2" aria-label="إغلاق">
            
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Profile Information Card */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-6 text-center space-y-4">
            <div className="flex justify-center">
              <Avatar name={studentName} size="xl" />
            </div>

            <div>
              <h2 className="text-base font-bold text-fg">{studentName}</h2>
              <p className="text-xs text-primary font-mono mt-0.5">{studentCode}</p>
            </div>

            <div className="pt-3 border-t border-border space-y-2.5 text-xs text-start">
              <div className="flex justify-between items-center py-1">
                <span className="text-fg-muted">الصف الدراسي:</span>
                <span className="font-semibold text-fg">{gradeLevel}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-fg-muted">البريد الإلكتروني:</span>
                <span className="font-mono text-fg text-xs truncate max-w-[150px]">
                  {user?.email || 'غير مسجل'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-fg-muted">رقم الهاتف:</span>
                <span className="font-mono text-fg text-xs">{user?.phone || 'غير مسجل'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-fg-muted">حالة الحساب:</span>
                <Badge variant="success">نشط وموثق</Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Device Binding & Security Card */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <SmartphoneIcon size={20} className="text-primary" />
                <h3 className="text-sm font-bold text-fg">الجهاز المرخص للدخول</h3>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success bg-success-subtle px-2.5 py-0.5 rounded-full border border-success/30">
                <ShieldIcon size={12} />
                حماية الجهاز الواحد (Single Device)
              </span>
            </div>

            {loading ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : activeCred ? (
              <div className="space-y-4">
                <div className="p-4 rounded-md border border-border bg-surface-sunken space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-fg-muted block">الجهاز المقترن حالياً:</span>
                      <h4 className="text-sm font-bold text-fg mt-0.5">
                        {activeBinding?.device_name || 'بانتظار تسجيل الدخول الأول من الجهاز'}
                      </h4>
                    </div>
                    <Badge variant={activeBinding ? 'success' : 'warning'}>
                      {activeBinding ? 'مقترن ومحمي' : 'غير مقترن بعد'}
                    </Badge>
                  </div>

                  {activeBinding && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
                      <div>
                        <span className="text-fg-muted">تاريخ الاقتران:</span>{' '}
                        <span className="font-mono text-fg">
                          {activeBinding.bound_at
                            ? formatDate(activeBinding.bound_at)
                            : 'الآن'}
                        </span>
                      </div>
                      <div>
                        <span className="text-fg-muted">بصمة الجهاز الرقمية:</span>{' '}
                        <span className="font-mono text-primary truncate">
                          {activeBinding.device_fingerprint?.slice(0, 16)}...
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-md border border-primary/20 bg-primary-subtle text-primary-subtle-fg space-y-1.5 text-xs">
                  <h5 className="font-bold flex items-center gap-1.5">
                    <CheckCircleIcon size={14} />
                    سياسة حماية المحتوى والامتحانات
                  </h5>
                  <p className="leading-relaxed">
                    لحماية خصوصية حسابك والمحتوى التعليمي، يسمح النظام بتشغيل الحساب من جهاز واحد فقط.
                    في حال قمت بتغيير هاتفك أو جهازك اللوحي، يمكنك تقديم طلب فوري للإدارة لفك الارتباط.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="primary"
                    onClick={() => handleOpenRequest(activeCred.id)}
                  >
                    تقديم طلب استبدال الجهاز المقترن
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-fg-muted text-xs">
                لا يوجد كود ترخيص نشط لهذا الحساب حالياً.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modal: Request Device Replacement */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => !isSubmitting && setIsRequestModalOpen(false)}
        title="طلب استبدال الجهاز المقترن"
        subtitle="يرجى كتابة سبب طلب تغيير الجهاز ليتم اعتماده من إدارة المركز التعليمي."
        size="md"
      >
        <form onSubmit={handleSubmitRequest} className="space-y-4 py-2 text-xs text-start">
          <Input
            label="اسم ونوع الجهاز الجديد (اختياري)"
            placeholder="مثال: iPad 10th Gen أو سامسونج جالكسي"
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
          />

          <div>
            <label className="text-xs font-semibold text-fg block mb-2">
              الأسباب الشائعة (اضغط للاختيار السريع):
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {REPLACEMENT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setReplaceReason(p)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                    replaceReason === p
                      ? 'border-primary bg-primary-subtle text-primary font-medium'
                      : 'border-border bg-surface text-fg-muted hover:border-primary/50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <textarea
              required
              rows={3}
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-xs text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              placeholder="اكتب سبب طلب استبدال الجهاز بالتفصيل..."
              value={replaceReason}
              onChange={(e) => setReplaceReason(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setIsRequestModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              disabled={!replaceReason.trim()}
            >
              إرسال الطلب للإدارة
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

