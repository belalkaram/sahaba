import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPage } from '../../components/layout/public-chrome';
import { RegistrationFlow } from '../../features/registration/registration-flow';

export const metadata: Metadata = { title: 'تسجيل طالب جديد' };

/** Public student registration (Saudi market). Requests go to the chosen centers / teachers for approval. */
export default function RegisterStudentPage() {
  return (
    <PublicPage>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 space-y-2 text-center">
          <h1 className="font-display text-3xl text-fg sm:text-4xl">تسجيل طالب جديد</h1>
          <p className="text-fg-muted">أنشئ حسابك واختر المؤسسات أو المدرسين الذين ترغب بالانضمام إليهم، وتصل طلباتك إليهم للموافقة.</p>
        </header>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-8">
          <RegistrationFlow />
        </div>
        <p className="mt-6 text-center text-sm text-fg-muted">
          لديك حساب؟{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            سجّل الدخول
          </Link>
        </p>
      </div>
    </PublicPage>
  );
}
