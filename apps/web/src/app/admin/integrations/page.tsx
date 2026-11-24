'use client';

import React from 'react';
import { Mail } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { GoogleConnectionCard } from '../../../features/google-drive/components/google-connection-card';

/**
 * R7E / R4-3 — integrations. Google shows the real connection state (ADR-008); email has no status endpoint yet,
 * so it says plainly that it is not available instead of showing a fake state.
 */
export default function AdminIntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="التكاملات"
        description="الخدمات الخارجية المرتبطة بمؤسستك."
        breadcrumbs={[{ label: 'لوحة المؤسسة', href: '/admin' }, { label: 'التكاملات' }]}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <GoogleConnectionCard />
        <Card className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-surface-muted text-fg-muted">
              <Mail size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <Badge variant="neutral" size="sm">
              غير متاح بعد
            </Badge>
          </div>
          <h2 className="text-base font-bold text-fg">البريد الإلكتروني</h2>
          <p className="text-sm leading-relaxed text-fg-muted">إرسال الإشعارات والرسائل إلى المستخدمين.</p>
          <p className="border-t border-border-subtle pt-3 text-xs leading-relaxed text-fg-subtle">
            يتطلب بيانات خادم SMTP. لا تُرسل رسائل حقيقية حتى تُضبط.
          </p>
        </Card>
      </div>
    </div>
  );
}
