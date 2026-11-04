'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { CheckCircleIcon } from '../../components/icons';


import { IconNext } from '../../components/icons/directional';
import { PublicPage } from '../../components/layout/public-chrome';
import { Button } from '../../components/ui/button';
import { publicApi } from '../../lib/public-api';
import { ApiError } from '../../lib/api-client';
export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    institution: '',
    message: '',
  });
  const [isSent, setIsSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Success is shown only after the server has stored the message.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setSendError(null);
    try {
      await publicApi.sendContactMessage({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        institution: formData.institution.trim() || undefined,
        message: formData.message.trim(),
      });
      setIsSent(true);
    } catch (err) {
      setSendError(err instanceof ApiError && err.status === 422 ? 'تحقّق من البيانات: الرسالة يجب ألا تقل عن ١٠ أحرف.' : 'تعذّر إرسال الرسالة. حاول مرة أخرى بعد قليل.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <PublicPage>
      <div className="py-12 px-6 relative overflow-hidden">
      <div className="max-w-3xl mx-auto relative z-10 space-y-8">
        

        <div className="text-center space-y-3">
          <Badge variant="success">فريق المبيعات والدعم الفني</Badge>
          <h1 className="text-3xl font-black text-fg">نحن هنا للإجابة على استفساراتك</h1>
          <p className="text-xs text-secondary max-w-lg mx-auto">
            أرسل لنا رسالتك وسيتواصل معك فريقنا.
          </p>
        </div>

        {!isSent ? (
          <Card className="p-8 bg-card/60 border-border backdrop-blur-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">الاسم الكريم *</label>
                  <input aria-label="الاسم الكريم"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="أ. محمد القحطاني"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">البريد الإلكتروني *</label>
                  <input aria-label="البريد الإلكتروني"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="m.qahtani@school.edu"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">رقم الجوال / الواتساب</label>
                  <input aria-label="رقم الجوال / الواتساب"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+966 5X XXX XXXX"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary font-mono"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1.5">اسم المؤسسة التعليمية</label>
                  <input aria-label="اسم المؤسسة التعليمية"
                    type="text"
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                    placeholder="مدارس المناهج الأهلية"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">نص الاستفسار أو الرسالة *</label>
                <textarea aria-label="نص الاستفسار أو الرسالة"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="كيف يمكنني ربط المنصة بنظام الفصول الحالية لمدرستي؟"
                  className="w-full bg-background border border-border rounded-lg p-3 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                />
              </div>

              {sendError && (
                <p role="alert" className="text-sm text-danger">
                  {sendError}
                </p>
              )}

              <Button type="submit" size="lg" fullWidth isLoading={isSending} iconEnd={<IconNext size={16} />}>
                إرسال الرسالة إلى فريق الدعم
              </Button>
            </form>
          </Card>
        ) : (
          <Card className="p-8 text-center space-y-4 bg-[color-mix(in_srgb,var(--pri)_15%,transparent)] border-primary/30">
            <div className="h-12 w-12 mx-auto rounded-full bg-primary/20 text-primary flex items-center justify-center">
              <CheckCircleIcon size={24} />
            </div>
            <h2 className="text-xl font-bold text-fg">شكراً لتواصلك معنا!</h2>
            <p className="text-xs text-secondary">
              وصلت رسالتك، وسيتواصل معك فريقنا عبر البيانات التي أدخلتها.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2.5 rounded-lg bg-card border-border border hover:bg-background hover:border-border hover:border text-fg text-xs font-semibold transition-colors"
            >
              العودة للرئيسية
            </Link>
          </Card>
        )}
      </div>
    </div>
    </PublicPage>
  );
}
