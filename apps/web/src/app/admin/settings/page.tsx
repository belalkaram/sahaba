'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { DataState } from '../../../components/ui/data-state';
import { ShieldIcon, CheckCircleIcon } from '../../../components/icons';
import { adminApi, type TenantCurrentInfo } from '../../../lib/admin-api';
import { useAuth } from '../../../context/auth-context';
import { ImageUploader } from '../../../components/ui/image-uploader';
import { Switch } from '../../../components/ui/switch';

import { Check } from 'lucide-react';
export default function TenantSettingsPage() {
  const { refreshSession } = useAuth();
  const [tenant, setTenant] = useState<TenantCurrentInfo | null>(null);
  const [logoVersion, setLogoVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0C7F6D');
  const [secondaryColor, setSecondaryColor] = useState('#4D7C0F');
  const [authMode, setAuthMode] = useState('hybrid');
  const [acceptsRegistrations, setAcceptsRegistrations] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getTenantCurrent();
      setTenant(data);
      setName(data.name || '');
      setTagline(data.brand_tagline || '');
      setLogoUrl(data.logo_url || '');
      setPrimaryColor(data.primary_color || '#0C7F6D');
      setSecondaryColor(data.secondary_color || '#4D7C0F');
      setAuthMode(data.auth_mode || 'hybrid');
      setAcceptsRegistrations(Boolean(data.accepts_registrations));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل تحميل إعدادات المؤسسة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const res = await adminApi.updateTenantSettings({
        name,
        brand_tagline: tagline.trim() || null,
        logo_url: logoUrl.trim() || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        auth_mode: authMode,
        accepts_registrations: acceptsRegistrations,
      });
      setTenant(res.tenant);
      await refreshSession();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const moduleLabels: Record<string, string> = {
    core: 'النظام الأساسي وإدارة المستخدمين',
    courses: 'المقررات والدروس الرقمية',
    attendance: 'الحصص والحضور والغياب',
    offline: 'المقرات والفروع والقاعات',
    billing: 'الاشتراكات وإيصالات الدفع',
    credentials: 'أكواد الدخول وأجهزة الطلاب',
    assessment: 'الاختبارات والواجبات والتصحيح',
    meetings: 'الفصول الافتراضية والاجتماعات',
    analytics: 'التقارير وتحليلات الأداء',
  };

  if (loading) {
    return (
      <div className="py-12">
        <DataState state="loading" message="جارٍ تحميل إعدادات المؤسسة والهوية..." />
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="py-12">
        <DataState state="error" message={error} onRetry={loadSettings} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-fg tracking-tight flex items-center gap-2">
          <ShieldIcon size={24} className="text-primary" />
          إعدادات المؤسسة والهوية البصرية (Tenant Settings & Branding)
        </h1>
        <p className="text-sm text-secondary mt-1">
          تخصيص ألوان المنصة، الشعار، نمط المصادقة، والاطلاع على الميزات المفعلة لمؤسستك.
        </p>
      </div>

      {success && (
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircleIcon size={18} />
          <span>تم حفظ وتحديث إعدادات المؤسسة بنجاح!</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings Column */}
          <div className="space-y-6 lg:col-span-2">
            {/* General Info */}
            <Card className="p-6 space-y-4">
              <h2 className="text-base font-bold text-fg border-b border-border pb-3">
                1. البيانات العامة للمؤسسة
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    اسم المؤسسة التعليمية *
                  </label>
                  <input aria-label="اسم المؤسسة التعليمية"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    الشعار اللفظي أو الوصف المختصر (Tagline)
                  </label>
                  <input aria-label="الشعار اللفظي أو الوصف المختصر (Tagline)"
                    type="text"
                    placeholder="مثال: منارة العلم نحو المستقبل"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    شعار المؤسسة (Upload Logo)
                  </label>
                  <ImageUploader
                    shape="avatar"
                    label="رفع شعار المؤسسة"
                    hint="يظهر الشعار في الشريط الجانبي وصفحات الأكاديمية (JPG، PNG، WebP حتى ٣ ميجابايت)"
                    hasImage={Boolean(logoUrl)}
                    version={logoVersion}
                    loadCurrent={() => adminApi.tenantLogoBlob()}
                    onUpload={async (file) => {
                      const res = await adminApi.uploadTenantLogo(file);
                      setTenant(res.tenant);
                      setLogoUrl(res.logo_url);
                      setLogoVersion((v) => v + 1);
                      await refreshSession();
                    }}
                    onRemove={async () => {
                      const res = await adminApi.deleteTenantLogo();
                      setTenant(res.tenant);
                      setLogoUrl('');
                      setLogoVersion((v) => v + 1);
                      await refreshSession();
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    رابط الشعار (Logo URL)
                  </label>
                  <input aria-label="رابط الشعار (Logo URL)"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary font-mono"
                    dir="ltr"
                  />
                </div>
              </div>
            </Card>

            {/* Visual Branding & Colors */}
            <Card className="p-6 space-y-4">
              <h2 className="text-base font-bold text-fg border-b border-border pb-3">
                2. الهوية البصرية والألوان (Branding Colors)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    اللون الأساسي (Primary Color)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="اللون الأساسي"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 w-12 rounded-sm cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg font-mono focus:outline-none focus:border-primary"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">
                    اللون الثانوي (Secondary Color)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="اللون الثانوي"
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-10 w-12 rounded-sm cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs text-fg font-mono focus:outline-none focus:border-primary"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Authentication Mode */}
            <Card className="p-6 space-y-4">
              <h2 className="text-base font-bold text-fg border-b border-border pb-3">
                3. نمط تسجيل دخول الطلاب (Authentication Mode)
              </h2>

              <div className="space-y-3">
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    authMode === 'hybrid'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background'
                  }`}
                >
                  <input
                    type="radio"
                    name="authMode"
                    value="hybrid"
                    checked={authMode === 'hybrid'}
                    onChange={(e) => setAuthMode(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-bold text-xs text-fg block">
                      نمط مختلط (Hybrid - موصى به)
                    </span>
                    <span className="text-xs text-secondary">
                      يسمح للطلاب بالدخول إما بكلمة المرور التقليدية أو عبر أكواد الدخول المطبوعة.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    authMode === 'password'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background'
                  }`}
                >
                  <input
                    type="radio"
                    name="authMode"
                    value="password"
                    checked={authMode === 'password'}
                    onChange={(e) => setAuthMode(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-bold text-xs text-fg block">
                      كلمة المرور فقط (Password Only)
                    </span>
                    <span className="text-xs text-secondary">
                      الدخول القياسي عبر البريد أو الهاتف وكلمة المرور.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    authMode === 'coupon'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background'
                  }`}
                >
                  <input
                    type="radio"
                    name="authMode"
                    value="coupon"
                    checked={authMode === 'coupon'}
                    onChange={(e) => setAuthMode(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-bold text-xs text-fg block">
                      أكواد الدخول السريعة (Coupons / QR Only)
                    </span>
                    <span className="text-xs text-secondary">
                      مناسب للمراكز السريعة وللطلبة الصغار بالدخول عبر كود الطالب أو بطاقته المطبوعة.
                    </span>
                  </div>
                </label>
              </div>
            </Card>
          </div>

          {/* Right Column: Live Preview & Modules */}
          <div className="space-y-6 lg:col-span-1">
            {/* Live Branding Preview */}
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-bold text-fg border-b border-border pb-2">
                معاينة حية للمظهر (Live Preview)
              </h2>

              <div className="p-4 rounded-md border border-border bg-background space-y-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-sm flex items-center justify-center font-bold text-fg text-xs shadow"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {name ? name.charAt(0) : 'L'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-fg">{name || 'اسم مؤسستك'}</div>
                    <div className="text-xs text-secondary">
                      {tagline || 'شعار المؤسسة التعليمية'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-sm text-fg text-xs font-medium shadow-sm transition-transform active:scale-95"
                    style={{ backgroundColor: primaryColor }}
                  >
                    زر رئيسي
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-sm text-fg text-xs font-medium shadow-sm"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    زر ثانوي
                  </button>
                </div>
              </div>
            </Card>

            {/* Read-only Modules List */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h2 className="text-sm font-bold text-fg">الأنظمة المفعلة لمؤسستك</h2>
                <Badge variant="neutral">للقراءة فقط</Badge>
              </div>

              <p className="text-xs text-secondary leading-relaxed">
                يتم تفعيل أو تعطيل الأنظمة والوحدات السحابية حصرياً عبر إدارة المنصة العليا (Platform
                Console).
              </p>

              <div className="space-y-1.5 pt-1">
                {tenant?.features && tenant.features.length > 0 ? (
                  tenant.features.map((feat) => (
                    <div
                      key={feat}
                      className="p-2 rounded-sm bg-background border border-border text-xs flex items-center justify-between"
                    >
                      <span className="text-fg font-medium">
                        {moduleLabels[feat] || feat}
                      </span>
                      <span className="text-primary font-bold"><Check size={16} strokeWidth={1.75} aria-hidden /></span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-secondary py-2">لا توجد ميزات مفعلة حالياً.</div>
                )}
              </div>
            </Card>
          </div>
        </div>

        <Card className="p-6 rounded-xl space-y-3">
          <Switch
            checked={acceptsRegistrations}
            onChange={setAcceptsRegistrations}
            label="استقبال طلبات تسجيل الطلاب من الصفحة العامة"
            description="عند التفعيل تظهر مؤسستك في قائمة التسجيل، وتصلك الطلبات في صفحة «طلبات التسجيل» لتقبلها أو ترفضها."
          />
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-fg transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
          >
            {saving ? 'جارٍ حفظ الإعدادات...' : 'حفظ التعديلات'}
          </button>
        </div>
      </form>
    </div>
  );
}
