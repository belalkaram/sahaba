'use client';

import React from 'react';
import { HardDrive, Mail, Video } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';

const INTEGRATIONS = [
  {
    icon: HardDrive,
    title: 'Google Drive',
    text: 'رفع مواد المقررات إلى مجلد خاص بمؤسستك مع مشاركة مقيّدة.',
    note: 'يتطلب مشروع Google Cloud وشاشة موافقة OAuth (المهمة R4-3).',
  },
  {
    icon: Video,
    title: 'Google Meet',
    text: 'إنشاء روابط الحصص المباشرة عبر تقويم Google.',
    note: 'يعتمد على ربط Google نفسه (المهمة R8-6). يمكن حالياً لصق رابط يدوي عند إنشاء الحصة.',
  },
  {
    icon: Mail,
    title: 'البريد الإلكتروني',
    text: 'إرسال الإشعارات والرسائل إلى المستخدمين.',
    note: 'يتطلب بيانات خادم SMTP. لا تُرسل رسائل حقيقية حتى تُضبط.',
  },
];

/**
 * R7E — integrations overview. No status endpoint exists yet, so this states plainly that the
 * connections are not available instead of showing a fake connected/disconnected state.
 */
export default function AdminIntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="التكاملات"
        description="الخدمات الخارجية المرتبطة بمؤسستك."
        breadcrumbs={[{ label: 'لوحة المؤسسة', href: '/admin' }, { label: 'التكاملات' }]}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {INTEGRATIONS.map(({ icon: Icon, title, text, note }) => (
          <Card key={title} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-surface-muted text-fg-muted">
                <Icon size={20} strokeWidth={1.75} aria-hidden />
              </span>
              <Badge variant="neutral" size="sm">
                غير متاح بعد
              </Badge>
            </div>
            <h2 className="ltr-isolate text-base font-bold text-fg">{title}</h2>
            <p className="text-sm leading-relaxed text-fg-muted">{text}</p>
            <p className="border-t border-border-subtle pt-3 text-xs leading-relaxed text-fg-subtle">{note}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
