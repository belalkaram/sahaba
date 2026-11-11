'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { ApiError } from '../../lib/api-client';
import { academyLoginHref, registrationApi, type RegistrationRequestStatus } from '../../lib/public-api';
import { normalizeMobile } from '../../lib/saudi';
import { normalizeDigits } from '../../lib/format';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { buttonClasses } from '../../components/ui/button-styles';

const RESULT: Record<RegistrationRequestStatus, { title: string; body: string; tone: string; Icon: typeof Clock }> = {
  pending: {
    title: 'طلبك قيد المراجعة',
    body: 'لم تتخذ الجهة قرارها بعد. عُد إلى هذه الصفحة لاحقاً.',
    tone: 'border-warning/30 bg-warning-subtle text-warning-subtle-fg',
    Icon: Clock,
  },
  approved: {
    title: 'تم قبول طلبك',
    body: 'حسابك جاهز. سجّل الدخول برقم جوال الطالب وكلمة المرور التي اخترتها عند التسجيل.',
    tone: 'border-success/30 bg-success-subtle text-success-subtle-fg',
    Icon: CheckCircle2,
  },
  rejected: {
    title: 'لم يُقبل طلبك',
    body: 'اعتذرت الجهة عن قبول الطلب. تواصل معها مباشرة، أو قدّم طلباً لجهة أخرى.',
    tone: 'border-danger/30 bg-danger-subtle text-danger-subtle-fg',
    Icon: XCircle,
  },
};

/** Public check of one registration request (academy code + reference + student mobile). */
export function RegistrationStatusCheck() {
  const params = useSearchParams();
  const [tenant, setTenant] = useState(params?.get('tenant') ?? '');
  const [reference, setReference] = useState(params?.get('ref') ?? '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<RegistrationRequestStatus | null>(null);
  const [checkedTenant, setCheckedTenant] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    const slug = tenant.trim().toLowerCase();
    const mobile = normalizeMobile(phone);
    if (!mobile) {
      setError('أدخل رقم جوال سعودي صحيح يبدأ بـ 05.');
      return;
    }
    setLoading(true);
    try {
      const result = await registrationApi.status({ tenant: slug, reference: normalizeDigits(reference.trim()).toUpperCase(), phone: mobile });
      setStatus(result);
      setCheckedTenant(slug);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setError('لا يوجد طلب بهذه البيانات. تأكد من رمز الأكاديمية ورقم الطلب ورقم الجوال.');
      else if (err instanceof ApiError && err.status === 429) setError('محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.');
      else if (err instanceof ApiError && err.status === 422) setError('أكمل كل الحقول.');
      else setError('تعذّر التحقق الآن. تحقق من الاتصال وحاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const result = status ? RESULT[status] : null;

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="رمز الأكاديمية" value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="مثال: almustaqbal" dir="ltr" autoCapitalize="none" spellCheck={false} required inputSize="lg" />
        <Input label="رقم الطلب" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="REG-XXXXXXXX" dir="ltr" autoCapitalize="characters" spellCheck={false} required inputSize="lg" />
        <Input label="رقم جوال الطالب" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" dir="ltr" autoComplete="tel" required inputSize="lg" />
        {error && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger-subtle p-3 text-sm font-medium text-danger-subtle-fg">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={loading || !tenant.trim() || !reference.trim() || !phone.trim()}>
          {loading ? 'جارٍ التحقق…' : 'تحقق من حالة الطلب'}
        </Button>
      </form>

      {result && (
        <div role="status" className={`space-y-3 rounded-lg border p-4 ${result.tone}`}>
          <p className="flex items-center gap-2 font-bold">
            <result.Icon size={20} aria-hidden /> {result.title}
          </p>
          <p className="text-sm">{result.body}</p>
          {status === 'approved' && (
            <Link href={academyLoginHref(checkedTenant)} className={buttonClasses('primary', 'md')}>
              تسجيل الدخول
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
