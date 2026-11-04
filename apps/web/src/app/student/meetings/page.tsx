'use client';

/**
 * R8-6 — Student live sessions: list with state and a real join button.
 * The join link comes from the backend after the access and time-window checks.
 * (Replaces a simulated in-page classroom whose chat and controls were not connected to anything.)
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Video } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card } from '../../../components/ui/card';
import { Badge, type BadgeVariant } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { ErrorState } from '../../../components/ui/error-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { IconExternal } from '../../../components/icons/directional';
import { integrationApi } from '../../../lib/integration-api';
import { ApiError } from '../../../lib/api-client';
import { formatDual, formatNumber, formatTime } from '../../../lib/format';
import type { Meeting } from '../../../types';

type MeetingState = 'upcoming' | 'live' | 'ended' | 'cancelled';

const STATE_LABEL: Record<MeetingState, { label: string; variant: BadgeVariant }> = {
  upcoming: { label: 'قادمة', variant: 'info' },
  live: { label: 'الآن', variant: 'success' },
  ended: { label: 'انتهت', variant: 'neutral' },
  cancelled: { label: 'ملغاة', variant: 'danger' },
};

function meetingState(meeting: Meeting, now: number): MeetingState {
  if (meeting.status === 'cancelled') return 'cancelled';
  if (meeting.status === 'completed') return 'ended';
  if (!meeting.start_time) return 'live';
  const start = new Date(meeting.start_time).getTime();
  const end = start + (meeting.duration_minutes ?? 60) * 60_000;
  if (now < start) return 'upcoming';
  return now <= end ? 'live' : 'ended';
}

export default function StudentMeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<{ id: string; message: string } | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setMeetings(await integrationApi.getMeetings());
      setNow(Date.now());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const join = async (meeting: Meeting) => {
    setJoining(meeting.id);
    setJoinError(null);
    try {
      const url = await integrationApi.getMeetingJoinUrl(meeting.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setJoinError({
        id: meeting.id,
        message: err instanceof ApiError ? err.message : 'تعذّر الدخول إلى الحصة. حاول مرة أخرى.',
      });
    } finally {
      setJoining(null);
    }
  };

  if (failed) return <ErrorState onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader title="الحصص المباشرة" description="حصصك المجدولة. يفتح زر الدخول قبل موعد الحصة بقليل." />

      {!meetings ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={<Video size={24} strokeWidth={1.75} aria-hidden />}
          title="لا توجد حصص مباشرة"
          description="عندما يجدول معلمك حصة مباشرة في مقرراتك ستظهر هنا."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {meetings.map((meeting) => {
            const state = meetingState(meeting, now);
            const { label, variant } = STATE_LABEL[state];
            return (
              <Card key={meeting.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-bold text-fg">{meeting.title}</h2>
                  <Badge variant={variant} dot={state === 'live'} size="sm">
                    {label}
                  </Badge>
                </div>
                {meeting.course?.title && <p className="text-sm text-fg-muted">{meeting.course.title}</p>}
                {meeting.description && <p className="text-sm leading-relaxed text-fg-muted">{meeting.description}</p>}
                {meeting.start_time && (
                  <p className="flex items-center gap-2 text-sm text-fg-muted">
                    <CalendarClock size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
                    <span>
                      {formatDual(meeting.start_time)} · {formatTime(meeting.start_time)} · {formatNumber(meeting.duration_minutes)} دقيقة
                    </span>
                  </p>
                )}
                {joinError?.id === meeting.id && (
                  <p role="alert" className="text-sm text-danger">
                    {joinError.message}
                  </p>
                )}
                {(state === 'live' || state === 'upcoming') && (
                  <Button
                    className="mt-auto"
                    variant={state === 'live' ? 'primary' : 'secondary'}
                    isLoading={joining === meeting.id}
                    onClick={() => join(meeting)}
                    iconEnd={<IconExternal size={16} />}
                  >
                    دخول الحصة
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
