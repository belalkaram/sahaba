'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Folder, Link as LinkIcon } from 'lucide-react';
import { integrationApi } from '../../../lib/integration-api';
import { educationApi } from '../../../lib/education-api';
import type { MediaAsset, Course } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { BookOpenIcon, VideoIcon } from '../../../components/icons';
import { formatDate, formatNumber } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
import { DriveVideoForm } from '../../../features/google-drive/components/drive-video-form';
import { mediaVerification } from '../../../features/google-drive/api';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  ready: { label: 'جاهز', variant: 'success' },
  processing: { label: 'قيد المعالجة في Drive', variant: 'warning' },
  failed: { label: 'فشل', variant: 'danger' },
};

/** Teacher video library: Drive uploads and pasted links (ADR-008). */
export default function TeacherMediaPage() {
  const [mediaList, setMediaList] = useState<MediaAsset[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [media, crs] = await Promise.all([integrationApi.getMedia(), educationApi.getCourses().catch(partial([]))]);
      setMediaList(media);
      setCourses(crs);
    } catch (err) {
      setLoadError(err instanceof Error ? err : new Error('load failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onCreated = (asset: MediaAsset) => {
    setMediaList((prev) => [asset, ...prev]);
    setIsAdding(false);
    setNotice(
      mediaVerification(asset) === 'verified'
        ? 'تم حفظ الفيديو وتأكيده من Google Drive.'
        : 'تم حفظ الرابط كـ"غير مؤكد": لم تستطع المنصة رؤية الملف. تأكد من مشاركته بالرابط.',
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-fg">
            <VideoIcon size={24} className="text-info" />
            مكتبة الفيديوهات
          </h1>
          <p className="mt-1 text-sm text-fg-muted">ارفع فيديوهات الدروس إلى Google Drive الخاص بالمؤسسة أو اربط ملفاً موجوداً.</p>
        </div>
        <Button onClick={() => { setIsAdding((v) => !v); setNotice(null); }} icon={<VideoIcon size={16} />}>
          {isAdding ? 'إغلاق' : 'إضافة فيديو'}
        </Button>
      </div>

      {notice && <p role="status" className="rounded-md border border-border bg-surface p-3 text-xs font-semibold text-fg">{notice}</p>}

      {isAdding && <DriveVideoForm courses={courses} onCreated={onCreated} onCancel={() => setIsAdding(false)} />}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-fg">الفيديوهات ({formatNumber(mediaList.length)})</h2>
          <span className="text-xs text-fg-muted">الأحدث أولاً</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-fg-muted">جارٍ التحميل…</div>
        ) : loadError ? (
          <ErrorState error={loadError} onRetry={loadData} />
        ) : mediaList.length === 0 ? (
          <Card className="p-12 text-center text-fg-muted">لا توجد فيديوهات بعد.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {mediaList.map((asset) => <MediaCard key={asset.id} asset={asset} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function MediaCard({ asset }: { asset: MediaAsset }) {
  const status = STATUS_BADGE[asset.status] ?? { label: asset.status, variant: 'neutral' as const };
  const verified = mediaVerification(asset) === 'verified';

  return (
    <Card className="flex flex-col justify-between overflow-hidden border border-border shadow-sm">
      <div className="relative flex aspect-video items-center justify-center border-b border-border bg-black/90">
        {asset.embed_url ? (
          <iframe src={asset.embed_url} className="h-full w-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen title={asset.title} />
        ) : (
          <VideoIcon size={32} className="text-fg-muted" />
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="info" size="sm" icon={<Folder size={14} aria-hidden />}>
              {asset.provider === 'google_drive' ? 'Google Drive' : asset.provider}
            </Badge>
            <Badge variant={status.variant} size="sm">{status.label}</Badge>
            {asset.provider === 'google_drive' && (
              <Badge variant={verified ? 'success' : 'warning'} size="sm">{verified ? 'مؤكد' : 'غير مؤكد'}</Badge>
            )}
          </div>
          <h3 className="text-sm font-bold leading-snug text-fg">{asset.title}</h3>
          <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-fg-muted">
            {asset.course && (
              <span className="flex items-center gap-1 rounded-xs border border-border px-2 py-0.5">
                <BookOpenIcon size={12} />
                {asset.course.code}
              </span>
            )}
            {asset.lesson && <span className="rounded-xs border border-border px-2 py-0.5">{asset.lesson.title}</span>}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-fg-muted">
          {asset.playback_url ? (
            <a href={asset.playback_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium text-info hover:underline">
              <LinkIcon size={16} aria-hidden /> فتح في Google Drive
            </a>
          ) : (
            <span className="font-mono">ID: {asset.external_media_id}</span>
          )}
          {asset.created_at && <span>{formatDate(asset.created_at)}</span>}
        </div>
      </div>
    </Card>
  );
}
