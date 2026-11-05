'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { staffProfileApi, type StaffPublicProfile } from '../../../lib/education-api';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Button } from '../../../components/ui/button';
import { ImageUploader } from '../../../components/ui/image-uploader';
import { PageHeader } from '../../../components/ui/page-header';
import { ErrorState } from '../../../components/ui/error-state';

export default function TeacherProfilePage() {
  const { session, tenant } = useAuth();
  const staffId = session?.profiles?.staff?.id;

  const [profile, setProfile] = useState<StaffPublicProfile | null>(null);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!staffId) return;
    try {
      const p = await staffProfileApi.get(staffId);
      setProfile(p);
      setHeadline(p.headline ?? '');
      setBio(p.public_bio ?? '');
      setIsPublic(p.is_public);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [staffId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId) return;
    setSaving(true);
    setNotice(null);
    try {
      await staffProfileApi.update(staffId, { headline: headline.trim() || null, public_bio: bio.trim() || null, is_public: isPublic });
      setNotice({ type: 'success', text: 'تم حفظ ملفك العام.' });
      await load();
    } catch {
      setNotice({ type: 'error', text: 'تعذّر حفظ الملف. حاول مرة أخرى.' });
    } finally {
      setSaving(false);
    }
  };

  if (!staffId) {
    return <ErrorState title="لا يوجد ملف مدرس" description="هذا الحساب غير مرتبط بملف مدرس." />;
  }
  if (loadError) {
    return <ErrorState title="تعذّر تحميل الملف" description="تحقق من الاتصال ثم أعد المحاولة." onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="ملفي العام" subtitle="صورتك ونبذتك كما تظهر للزوار في صفحة مدرسي الأكاديمية. لا تظهر بيانات التواصل أبدًا." />

      <Card className="max-w-2xl space-y-6 p-6">
        <ImageUploader
          shape="avatar"
          label="صورتي الشخصية"
          hasImage={Boolean(profile?.has_photo)}
          version={photoVersion}
          loadCurrent={() => staffProfileApi.photoBlob(staffId)}
          onUpload={async (file) => {
            await staffProfileApi.uploadPhoto(staffId, file);
            setPhotoVersion((v) => v + 1);
            await load();
          }}
          onRemove={async () => {
            await staffProfileApi.deletePhoto(staffId);
            await load();
          }}
        />

        <form onSubmit={save} className="space-y-4 border-t border-border pt-6">
          <div>
            <label htmlFor="headline" className="mb-1 block text-sm font-medium text-fg">
              العنوان المختصر
            </label>
            <Input id="headline" value={headline} maxLength={160} onChange={(e) => setHeadline(e.target.value)} placeholder="مثال: مدرس الفيزياء — خبرة ١٠ سنوات" />
          </div>
          <div>
            <label htmlFor="bio" className="mb-1 block text-sm font-medium text-fg">
              نبذة تعريفية
            </label>
            <Textarea id="bio" rows={5} maxLength={2000} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="space-y-3">
            <Switch
              checked={isPublic}
              onChange={async (checked) => {
                if (!staffId) return;
                setIsPublic(checked);
                setNotice(null);
                try {
                  await staffProfileApi.update(staffId, { is_public: checked });
                  setNotice({
                    type: 'success',
                    text: checked ? 'ملفك أصبح ظاهراً للعامة في صفحة مدرسي الأكاديمية وفي دليل المنصة.' : 'تم إخفاء ملفك عن العامة بنجاح.'
                  });
                  await load();
                } catch {
                  setIsPublic(!checked);
                  setNotice({ type: 'error', text: 'تعذّر تحديث حالة ظهور الملف. حاول مرة أخرى.' });
                }
              }}
              label="إظهار ملفي في صفحة مدرسي الأكاديمية ودليل المنصة"
              description="عند التفعيل يظهر اسمك وصورتك ونبذتك في صفحة مدرسي الأكاديمية وقسم المدرسين في الصفحة الرئيسية."
            />

            <div className="flex flex-wrap items-center gap-3 pr-8">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isPublic ? 'bg-success/15 text-success border border-success/30' : 'bg-muted text-secondary border border-border'
              }`}>
                {isPublic ? '● ملفك ظاهر للعامة' : '○ ملفك مخفي عن العامة'}
              </span>
              {tenant?.slug && isPublic && (
                <Link
                  href={`/a/${tenant.slug}/teachers`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  شوف صفحتك العامة <ExternalLink size={12} aria-hidden />
                </Link>
              )}
            </div>
          </div>

          {notice && (
            <p role="status" className={notice.type === 'success' ? 'text-sm font-medium text-success' : 'text-sm font-medium text-danger'}>
              {notice.text}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" isLoading={saving} disabled={saving}>
              حفظ الملف
            </Button>
            {tenant?.slug && (
              <Link href={`/a/${tenant.slug}/teachers`} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                معاينة الصفحة العامة <ExternalLink size={14} aria-hidden />
              </Link>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
