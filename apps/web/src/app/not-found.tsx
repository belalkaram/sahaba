import Link from 'next/link';
import { Compass } from 'lucide-react';
import { buttonClasses } from '../components/ui/button-styles';
import { BrandLockup } from '../components/brand/brand-mark';
import { IconBack } from '../components/icons/directional';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface-sunken p-6 text-center">
      <span className="pattern-overlay [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" aria-hidden />
      <div className="relative space-y-8">
        <Link href="/" className="inline-flex">
          <BrandLockup size={40} />
        </Link>
        <div className="arch relative mx-auto grid h-40 w-32 place-items-center overflow-hidden bg-gradient-brand text-white shadow-lg">
          <span className="pattern-overlay [background-color:rgba(255,255,255,0.12)]" aria-hidden />
          <span className="relative font-display text-5xl">٤٠٤</span>
        </div>
        <div className="mx-auto max-w-md space-y-2">
          <h1 className="font-display text-3xl text-fg">الصفحة غير موجودة</h1>
          <p className="text-base text-fg-muted">ربما نُقلت الصفحة أو أن الرابط غير صحيح. عُد إلى الرئيسية أو سجّل الدخول للوصول إلى لوحتك.</p>
        </div>
        <div className="flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <Link href="/login" className={buttonClasses('secondary', 'lg')}>
            <Compass size={18} strokeWidth={1.75} aria-hidden />
            تسجيل الدخول
          </Link>
          <Link href="/" className={buttonClasses('primary', 'lg')}>
            <IconBack size={18} />
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
