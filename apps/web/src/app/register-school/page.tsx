'use client';

/**
 * R2-5 — Self-Service School Registration
 * Calls real POST /public/register-school API with atomic tenant provisioning.
 * Zero mock setTimeout, handles real validation errors.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '../../components/ui/card';
import { CheckCircleIcon, ShieldIcon } from '../../components/icons';
import { apiClient, ApiError } from '../../lib/api-client';

import { TriangleAlert } from 'lucide-react';
import { IconNext } from '../../components/icons/directional';
import { PublicPage } from '../../components/layout/public-chrome';
interface RegistrationSuccessData {
  message: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  owner: {
    email: string;
    name: string;
  };
  login_url: string;
}

export default function RegisterSchoolPage() {
  const [formData, setFormData] = useState({
    institutionName: '',
    slug: '',
    institutionType: 'individual_teacher',
    organizationKind: 'center',
    services: ['online', 'offline'] as string[],
    city: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    password: '',
    honeypot: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<RegistrationSuccessData | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.institutionName || !formData.slug || !formData.adminName || !formData.adminEmail || !formData.password) {
      setError('يرجى ملء جميع الحقول الإلزامية (*)');
      return;
    }

    if (formData.password.length < 8) {
      setError('كلمة المرور يجب ألا تقل عن 8 أحرف.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      if (formData.services.length === 0) {
        setError('يرجى اختيار خدمة واحدة على الأقل (أونلاين أو أوفلاين)');
        return;
      }

      const response = await apiClient.post<RegistrationSuccessData>('/public/register-school', {
        school_name: formData.institutionName.trim(),
        slug: formData.slug.trim().toLowerCase(),
        type: formData.institutionType,
        organization_kind: formData.institutionType === 'organization' ? formData.organizationKind : undefined,
        services: formData.services,
        city: formData.city.trim() || undefined,
        admin_name: formData.adminName.trim(),
        admin_email: formData.adminEmail.trim().toLowerCase(),
        admin_phone: formData.adminPhone.trim() || null,
        password: formData.password,
        _hp: formData.honeypot || null,
      });

      setSuccessData(response.data);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'فشل تسجيل المؤسسة التعليمية. يرجى المحاولة لاحقاً.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicPage>
      <div className="py-12 px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Navigation back */}
        

        {!successData ? (
          <Card className="p-8 md:p-10 border-border bg-card/60 backdrop-blur-xl shadow-xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto mb-3 shadow-inner">
                <ShieldIcon size={24} />
              </div>
              <h1 className="text-2xl font-black text-fg">تسجيل وتأسيس مؤسسة تعليمية جديدة</h1>
              <p className="text-xs text-secondary mt-1.5 leading-relaxed">
                أنشئ بيئتك السحابية المعزولة لمدرستك أو مركزك التعليمي فوراً مع تجربة مجانية لكافة الميزات.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-md bg-danger/10 border border-danger/20 text-danger text-xs text-center font-medium">
                
 <TriangleAlert size={16} strokeWidth={1.75} aria-hidden /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot field (hidden from humans) */}
              <input
                type="text"
                name="_hp"
                value={formData.honeypot}
                onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />

              {/* Step 1: Institution Info */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-primary uppercase tracking-wider block">
                  1. معلومات المؤسسة والنطاق
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1.5">
                      اسم المؤسسة أو المركز التعليمي *
                    </label>
                    <input aria-label="اسم المؤسسة أو المركز التعليمي"
                      type="text"
                      placeholder="مثال: أكاديمية النخبة للغات"
                      value={formData.institutionName}
                      onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1.5">
                      معرف النطاق الفريد (Slug - إنجليزي فقط) *
                    </label>
                    <input aria-label="معرف النطاق الفريد (Slug - إنجليزي فقط)"
                      type="text"
                      placeholder="مثال: el-nokhba"
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                        })
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-primary font-mono placeholder-fg-subtle focus:outline-none focus:border-primary"
                      required
                    />
                    <span className="text-xs text-secondary block mt-1">
                      معرف المؤسسة: {formData.slug || 'slug'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1.5">
                      أنا... *
                    </label>
                    <select aria-label="نوع الحساب"
                      value={formData.institutionType}
                      onChange={(e) => setFormData({ ...formData, institutionType: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                    >
                      <option value="individual_teacher">معلم مستقل (Individual Teacher)</option>
                      <option value="organization">مؤسسة تعليمية كاملة (Organization)</option>
                    </select>
                  </div>

                  {formData.institutionType === 'organization' && (
                    <div>
                      <label className="block text-xs font-semibold text-secondary mb-1.5">
                        نوع المؤسسة *
                      </label>
                      <select aria-label="نوع المؤسسة"
                        value={formData.organizationKind}
                        onChange={(e) => setFormData({ ...formData, organizationKind: e.target.value })}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                      >
                        <option value="center">مركز تعليمي / سنتر (Center)</option>
                        <option value="academy">أكاديمية تعليمية (Academy)</option>
                        <option value="school">مدرسة (School)</option>
                        <option value="institute">معهد (Institute)</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1.5">
                      المدينة / المقر
                    </label>
                    <input aria-label="المدينة / المقر"
                      type="text"
                      placeholder="مثال: الرياض أو القاهرة"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-surface-raised space-y-2">
                  <label className="block text-xs font-bold text-fg">
                    الخدمات التي تحتاجها (اختر واحدة على الأقل) *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border bg-surface cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={formData.services.includes('online')}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...formData.services, 'online']
                            : formData.services.filter((s) => s !== 'online');
                          setFormData({ ...formData, services: next });
                        }}
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="font-bold text-fg block">الخدمة الأونلاين (Online)</span>
                        <span className="text-secondary text-[0.6875rem] block">المقررات، الفيديوهات، الحصص المباشرة، الاختبارات الرقمية</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border bg-surface cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={formData.services.includes('offline')}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...formData.services, 'offline']
                            : formData.services.filter((s) => s !== 'offline');
                          setFormData({ ...formData, services: next });
                        }}
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="font-bold text-fg block">الخدمة الأوفلاين (Offline)</span>
                        <span className="text-secondary text-[0.6875rem] block">الحضور بالـQR، الفصول، الحصص، القاعات والمقرات، المساعدين</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Step 2: Administrator Profile */}
              <div className="space-y-4 pt-4 border-t border-border">
                <span className="text-xs font-bold text-primary uppercase tracking-wider block">
                  2. بيانات المدير المسؤول (مالك الحساب)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1.5">
                      الاسم الكامل للمسؤول *
                    </label>
                    <input aria-label="الاسم الكامل للمسؤول"
                      type="text"
                      placeholder="د. أحمد المحمدي"
                      value={formData.adminName}
                      onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1.5">
                      البريد الإلكتروني للإدارة *
                    </label>
                    <input aria-label="البريد الإلكتروني للإدارة"
                      type="email"
                      placeholder="admin@institution.edu"
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
                      dir="ltr"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1.5">
                      رقم الجوال
                    </label>
                    <input aria-label="رقم الجوال"
                      type="tel"
                      placeholder="+966 50 123 4567"
                      value={formData.adminPhone}
                      onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1.5">
                      كلمة مرور الحساب الإداري (8 أحرف فأكثر) *
                    </label>
                    <input aria-label="كلمة مرور الحساب الإداري (8 أحرف فأكثر)"
                      type="password"
                      placeholder="••••••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg font-bold text-xs shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-border border-t-white animate-spin" />
                      <span>جارٍ تهيئة بيئة المؤسسة وقاعدة البيانات المعزولة...</span>
                    </>
                  ) : (
                    <span>تأكيد التسجيل وتأسيس المنصة فوراً (Get Started) <IconNext size={16} /></span>
                  )}
                </button>
              </div>
            </form>
          </Card>
        ) : (
          <Card className="p-8 md:p-12 border-primary/30 bg-[color-mix(in_srgb,var(--pri)_15%,transparent)] backdrop-blur-xl text-center space-y-6">
            <div className="h-16 w-16 mx-auto rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <CheckCircleIcon size={32} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-fg">مبروك! تم تأسيس بيئة مؤسستك بنجاح</h2>
              <p className="text-xs text-secondary mt-2">
                تم إنشاء قاعدة البيانات المعزولة بنجاح وحساب المدير التنفيذي الخاص بك. يمكنك تسجيل الدخول فوراً.
              </p>
            </div>

            <div className="p-4 bg-background/80 rounded-xl border border-border text-start text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-border/80">
                <span className="text-secondary">المؤسسة:</span>
                <span className="text-fg font-semibold">{successData.tenant.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/80">
                <span className="text-secondary">المعرف (Slug):</span>
                <span className="text-primary font-mono font-bold">{successData.tenant.slug}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/80">
                <span className="text-secondary">البريد الإلكتروني للإدارة:</span>
                <span className="text-fg font-mono" dir="ltr">{successData.owner.email}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/login?tenant=${successData.tenant.slug}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-primary hover:bg-primary text-primary-fg font-bold text-xs shadow-lg shadow-primary/30 transition-all"
              >
                <span>الانتقال لتسجيل الدخول فوراً</span>
                <span><IconNext size={16} /></span>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
    </PublicPage>
  );
}
