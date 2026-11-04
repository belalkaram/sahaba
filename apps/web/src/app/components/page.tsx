'use client';

/**
 * R7-0b — Design system gallery (development only; 404 in production builds).
 * Visual reference for tokens, typography, primitives, motion and RTL arrow rules.
 */

import React, { useState } from 'react';
import { notFound } from 'next/navigation';
import { Download, Plus, Search, Settings, Trash2, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { KpiCard } from '../../components/ui/kpi-card';
import { Tabs } from '../../components/ui/tabs';
import { Modal } from '../../components/ui/modal';
import { Drawer } from '../../components/ui/drawer';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { ThemeSwitcher } from '../../components/layout/theme-switcher';
import { BrandLockup } from '../../components/brand/brand-mark';
import {
  IconBack,
  IconChevronNext,
  IconChevronPrev,
  IconExpand,
  IconExternal,
  IconNext,
} from '../../components/icons/directional';
import { formatCurrency, formatDual, formatPercent, formatRelative } from '../../lib/format';

const SWATCHES = [
  ['surface', 'bg-surface'],
  ['surface-sunken', 'bg-surface-sunken'],
  ['surface-muted', 'bg-surface-muted'],
  ['primary', 'bg-primary'],
  ['primary-subtle', 'bg-primary-subtle'],
  ['accent', 'bg-accent'],
  ['accent-subtle', 'bg-accent-subtle'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['danger', 'bg-danger'],
  ['info', 'bg-info'],
  ['brand gradient', 'bg-gradient-brand'],
] as const;

const ARROWS = [
  { use: 'التالي / متابعة / عرض الكل', icon: <IconNext />, name: 'IconNext' },
  { use: 'رجوع / السابق', icon: <IconBack />, name: 'IconBack' },
  { use: 'صفحة تالية، مسار التنقل', icon: <IconChevronNext />, name: 'IconChevronNext' },
  { use: 'صفحة سابقة', icon: <IconChevronPrev />, name: 'IconChevronPrev' },
  { use: 'فتح / طي (لا يُعكس)', icon: <IconExpand />, name: 'IconExpand' },
  { use: 'رابط خارجي', icon: <IconExternal />, name: 'IconExternal' },
];

export default function DesignSystemGallery() {
  const [tab, setTab] = useState('a');
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="min-h-screen bg-surface-sunken">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-6 py-3 backdrop-blur-md">
        <BrandLockup size={34} />
        <ThemeSwitcher />
      </header>
      <main className="mx-auto max-w-[var(--content-max)] space-y-10 p-6 lg:p-10">
        <PageHeader
          eyebrow="R7 — Design System"
          title="مكتبة مكوّنات سحابة"
          description="مرجع بصري للتوكنز والطباعة والمكوّنات والحركة وقواعد الأسهم في RTL. متاحة في بيئة التطوير فقط."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'نظام التصميم' }]}
          actions={
            <>
              <Button variant="secondary" icon={<Download size={16} />}>
                تصدير
              </Button>
              <Button icon={<Plus size={16} />}>إجراء أساسي</Button>
            </>
          }
        />

        <Card>
          <CardHeader title="الألوان الدلالية" description="القيم من styles/tokens.css وتتبدّل تلقائياً مع الثيم." />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {SWATCHES.map(([name, cls]) => (
              <div key={name} className="overflow-hidden rounded-md border border-border">
                <div className={`h-16 ${cls}`} />
                <p className="ltr-isolate px-2 py-1.5 text-xs text-fg-muted">{name}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="الطباعة" description="Liftaswash للعناوين العربية الكبرى فقط، وIBM Plex Sans Arabic لبقية الواجهة." />
          <div className="space-y-3">
            <p className="font-display text-5xl text-fg">سحابة تعليمية</p>
            <h1 className="text-3xl text-fg">عنوان صفحة رئيسي</h1>
            <h2 className="text-2xl text-fg">عنوان قسم</h2>
            <h3 className="text-xl font-bold text-fg">عنوان بطاقة</h3>
            <p className="text-base text-fg">نص أساسي للقراءة بارتفاع سطر مريح للعربية.</p>
            <p className="text-sm text-fg-muted">نص وصفي ثانوي.</p>
            <p className="text-xs text-fg-subtle">نص صغير — الحد الأدنى ١٢ بكسل.</p>
            <p className="text-sm text-fg">
              {formatDual('2026-11-12T16:30:00')} · {formatPercent(85)} · {formatCurrency(399)} · {formatRelative(new Date(Date.UTC(2026, 10, 1)))}
            </p>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="الأزرار" />
            <div className="flex flex-wrap gap-3">
              <Button>أساسي</Button>
              <Button variant="secondary">ثانوي</Button>
              <Button variant="outline">محدّد</Button>
              <Button variant="subtle">هادئ</Button>
              <Button variant="ghost">شفاف</Button>
              <Button variant="danger" icon={<Trash2 size={16} />}>
                حذف
              </Button>
              <Button isLoading>جارٍ الحفظ</Button>
              <Button variant="link">رابط</Button>
              <Button size="icon" variant="secondary" aria-label="الإعدادات">
                <Settings size={18} />
              </Button>
              <Button iconEnd={<IconNext size={16} />}>التالي</Button>
              <Button variant="secondary" icon={<IconBack size={16} />}>
                رجوع
              </Button>
            </div>
          </Card>
          <Card>
            <CardHeader title="الشارات والتبويبات" />
            <div className="flex flex-wrap gap-2">
              {(['neutral', 'brand', 'success', 'warning', 'danger', 'info', 'accent'] as const).map((v) => (
                <Badge key={v} variant={v} dot>
                  {v}
                </Badge>
              ))}
            </div>
            <div className="mt-5 space-y-4">
              <Tabs tabs={[{ id: 'a', label: 'نظرة عامة' }, { id: 'b', label: 'الطلاب', badge: 24 }, { id: 'c', label: 'الإعدادات' }]} activeTab={tab} onChange={setTab} />
              <Tabs variant="underline" tabs={[{ id: 'a', label: 'المنهج' }, { id: 'b', label: 'التقييمات' }, { id: 'c', label: 'الحضور' }]} activeTab={tab} onChange={setTab} />
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="الحقول" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="الاسم" placeholder="اكتب الاسم" required />
              <Input label="البحث" placeholder="ابحث…" iconPrefix={<Search size={16} />} />
              <Input label="رقم الجوال" type="tel" dir="ltr" placeholder="05xxxxxxxx" helperText="يقبل الأرقام العربية والإنجليزية." />
              <Input label="البريد" error="صيغة البريد غير صحيحة" defaultValue="name@" dir="ltr" />
              <Select label="الشعبة" options={[{ value: '1', label: 'الرياضيات أ' }, { value: '2', label: 'الفيزياء ب' }]} />
            </div>
          </Card>
          <Card>
            <CardHeader title="الأسهم في RTL" description="مكوّنات دلالية: تنعكس تلقائياً داخل منطقة LTR." />
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {ARROWS.map((a) => (
                  <tr key={a.name}>
                    <td className="py-2.5 text-fg">{a.use}</td>
                    <td className="py-2.5 text-primary">{a.icon}</td>
                    <td className="py-2.5 text-primary" dir="ltr">
                      {a.icon}
                    </td>
                    <td className="ltr-isolate py-2.5 text-xs text-fg-subtle">{a.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="الطلاب المسجّلون" value={1284} icon={<Users size={20} />} delta={{ value: '١٢٪', isPositive: true, label: 'عن الشهر الماضي' }} />
          <KpiCard label="نسبة الحضور" value={92} unit="percent" tone="success" hint="آخر ٣٠ يوماً" />
          <KpiCard label="مدفوعات معلّقة" value={7} tone="warning" />
          <KpiCard label="الإيرادات" value={formatCurrency(48250)} tone="accent" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card variant="brand" className="lg:col-span-2">
            <h3 className="font-display text-2xl">بطاقة الهوية (brand)</h3>
            <p className="mt-2 text-white/75">للمواضع المميزة فقط: «تابع التعلّم» والـ Hero.</p>
          </Card>
          <Card variant="interactive">
            <h3 className="text-base font-bold text-fg">بطاقة تفاعلية</h3>
            <p className="mt-1 text-sm text-fg-muted">ترتفع قليلاً عند المرور.</p>
          </Card>
        </div>

        <EmptyState title="لا توجد واجبات بعد" description="عندما يضيف معلمك واجباً سيظهر هنا مع موعد التسليم." action={{ label: 'استعراض المقررات', onClick: () => undefined }} />

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setModal(true)}>
            فتح نافذة
          </Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>
            فتح لوحة جانبية
          </Button>
        </div>
      </main>

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title="تأكيد الإجراء"
        subtitle="نافذة مركزية على الديسكتوب وورقة سفلية على الجوال."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>
              إلغاء
            </Button>
            <Button onClick={() => setModal(false)}>تأكيد</Button>
          </>
        }
      >
        <Input label="سبب الإجراء" />
      </Modal>
      <Drawer isOpen={drawer} onClose={() => setDrawer(false)} title="تفاصيل الطلب" subtitle="تنزلق من بداية السطر (اليمين).">
        <p className="text-sm text-fg-muted">محتوى اللوحة الجانبية.</p>
      </Drawer>
    </div>
  );
}
