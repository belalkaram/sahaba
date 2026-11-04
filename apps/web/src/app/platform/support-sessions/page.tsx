'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { ShieldIcon, ClockIcon } from '../../../components/icons';
import { platformApi, type SupportSessionRecord } from '../../../lib/platform-api';
import type { Tenant } from '../../../types';

import { School, ShieldCheck, X } from 'lucide-react';
import { IconBack } from '../../../components/icons/directional';
import { formatDateTime, formatNumber } from '../../../lib/format';
export default function SupportSessionsPage() {
  const [sessions, setSessions] = useState<SupportSessionRecord[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Support Session Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [reason, setReason] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sessionsData, tenantsData] = await Promise.all([
        platformApi.getSupportSessions(),
        platformApi.getTenants(),
      ]);
      setSessions(sessionsData);
      setTenants(tenantsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل جلسات الدعم الفني');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId || !reason.trim()) return;

    setIsStarting(true);
    try {
      const res = await platformApi.generateSupportCode(selectedTenantId, reason);
      const tenant = tenants.find((t) => t.id === selectedTenantId);
      const slug = tenant ? tenant.slug : res.tenant;

      // Open new tab with one-time exchange code
      const url = `/login?support_code=${res.support_code}&tenant=${slug}`;
      window.open(url, '_blank');

      setIsModalOpen(false);
      setSelectedTenantId('');
      setReason('');
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل بدء جلسة الدعم الفني');
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في إنهاء هذه الجلسة فوراً؟ سيتم إلغاء صلاحية الوصول.')) {
      return;
    }

    try {
      await platformApi.endSupportSession(sessionId);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: 'ended', ended_at: new Date().toISOString() } : s))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل إنهاء الجلسة');
    }
  };

  const activeSessions = sessions.filter((s) => s.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/platform/tenants" className="text-xs text-secondary hover:text-fg">
              
 <IconBack size={16} /> العودة لإدارة المؤسسات
 </Link>
          </div>
          <h1 className="text-2xl font-bold text-fg tracking-tight flex items-center gap-2">
            <ShieldIcon size={24} className="text-warning" />
            سجل ومراقبة جلسات الدعم الفني (Support Sessions)
          </h1>
          <p className="text-sm text-secondary mt-1">
            تدقيق كامل ومسار زمني لجلسات دخول المهندسين للمستأجرين (Master §7: Support access is temporary and auditable).
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-warning hover:bg-warning-hover text-warning-fg font-medium px-4 py-2.5 rounded-lg text-xs transition-all shadow-lg shadow-warning/30 active:scale-95"
        >
          <span><ShieldCheck size={16} strokeWidth={1.75} aria-hidden /></span>
          <span>بدء جلسة دعم فني جديدة</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-card/60 border-border">
          <p className="text-xs text-secondary font-medium">الجلسات النشطة الآن</p>
          <p className="text-2xl font-bold text-warning mt-1">{formatNumber(activeSessions.length)}</p>
          <div className="mt-2 text-xs text-warning">جلسات دخول جارية تحت المراقبة</div>
        </Card>
        <Card className="p-4 bg-card/60 border-border">
          <p className="text-xs text-secondary font-medium">إجمالي الجلسات المسجلة</p>
          <p className="text-2xl font-bold text-fg mt-1">{formatNumber(sessions.length)}</p>
          <div className="mt-2 text-xs text-secondary">مسجلة في سجلات التدقيق المركزية</div>
        </Card>
        <Card className="p-4 bg-card/60 border-border">
          <p className="text-xs text-secondary font-medium">أمان الدعم الفني</p>
          <p className="text-2xl font-bold text-primary mt-1">100%</p>
          <div className="mt-2 text-xs text-primary">استبدال رمز لمرة واحدة + انتهاء تلقائي</div>
        </Card>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-12 text-center text-secondary text-sm">جارٍ تحميل سجل الجلسات...</div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm text-center">
          {error}
        </div>
      ) : (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-fg">جلسات التدخل الفني</h2>
            <span className="text-xs text-secondary">عدد الجلسات: {formatNumber(sessions.length)}</span>
          </div>

          <div tabIndex={0} className="overflow-x-auto">
            {sessions.length === 0 ? (
              <div className="text-center py-10 text-secondary text-sm">
                لا توجد جلسات دعم فني سابقة أو نشطة.
              </div>
            ) : (
              <table className="w-full text-start text-xs">
                <thead className="border-b border-border text-secondary">
                  <tr>
                    <th className="pb-3 px-3">المؤسسة المستهدفة</th>
                    <th className="pb-3 px-3">سبب التدخل (Reason)</th>
                    <th className="pb-3 px-3">الحالة</th>
                    <th className="pb-3 px-3">وقت البدء</th>
                    <th className="pb-3 px-3">وقت الانتهاء</th>
                    <th className="pb-3 px-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-card/40 transition-colors">
                      <td className="py-4 px-3 font-semibold text-fg">
                        <div className="flex items-center gap-2">
                          <span className="text-base"><School size={18} strokeWidth={1.75} aria-hidden /></span>
                          <div>
                            <div>{session.tenant?.name ?? session.tenant_id}</div>
                            {session.tenant?.slug && (
                              <span className="text-xs text-secondary font-mono">{session.tenant.slug}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3 text-secondary max-w-xs truncate" title={session.reason}>
                        {session.reason}
                      </td>
                      <td className="py-4 px-3">
                        {session.status === 'active' ? (
                          <Badge variant="warning">نشطة الآن</Badge>
                        ) : (
                          <Badge variant="neutral">منتهية</Badge>
                        )}
                      </td>
                      <td className="py-4 px-3 text-secondary font-mono text-xs" dir="ltr">
                        {formatDateTime(session.accessed_at)}
                      </td>
                      <td className="py-4 px-3 text-secondary font-mono text-xs" dir="ltr">
                        {session.ended_at
                          ? formatDateTime(session.ended_at)
                          : formatDateTime(session.expires_at)}
                      </td>
                      <td className="py-4 px-3 text-center">
                        {session.status === 'active' && (
                          <button
                            onClick={() => handleEndSession(session.id)}
                            className="px-3 py-1 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 rounded-sm text-xs font-medium transition-colors"
                          >
                            إنهاء الجلسة فوراً
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      {/* Start Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/20 border border-warning/30 flex items-center justify-center text-warning">
                  <ShieldIcon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">بدء جلسة دعم فني مؤقتة</h3>
                  <p className="text-xs text-secondary mt-0.5">صلاحية دخول تشخيصية مقيدة بمدة زمنية</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-secondary hover:text-fg p-1 rounded-sm"
               aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            <form onSubmit={handleStartSession} className="py-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">
                  اختر المؤسسة المستهدفة *
                </label>
                <select aria-label="اختر المؤسسة المستهدفة"
                  required
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-warning"
                >
                  <option value="">-- اختر مدرسة / مؤسسة --</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">
                  سبب التدخل الفني (إلزامي للتدقيق) *
                </label>
                <textarea aria-label="سبب التدخل الفني (إلزامي للتدقيق)"
                  required
                  rows={3}
                  placeholder="مثال: فحص تقارير الطلاب بناء على تذكرة الدعم رقم #512"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-warning resize-none"
                />
              </div>

              <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-xs flex items-center gap-2">
                <ClockIcon size={14} className="shrink-0" />
                <span>تنتهي الجلسة تلقائياً بعد ساعتين ويتم تسجيل جميع العمليات في Audit Logs.</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-secondary hover:text-fg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isStarting || !selectedTenantId || !reason.trim()}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-warning hover:bg-warning-hover text-warning-fg transition-all shadow-lg disabled:opacity-50"
                >
                  {isStarting ? 'جاري التحويل...' : 'بدء الجلسة وفتح المنظومة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
