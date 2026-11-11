'use client';

import React from 'react';
import Link from 'next/link';
import { BookmarkIcon, BookmarkCheckIcon, PlayIcon, TrashIcon, ClockIcon } from '../../../components/icons';
import { useSavedVideos, SavedVideo } from '../hooks/use-saved-videos';
import { formatRelative } from '../../../lib/format';
import type { Course } from '../../../types';

export interface SavedVideosWidgetProps {
  userId?: string;
  courses?: Course[];
}

export const SavedVideosWidget: React.FC<SavedVideosWidgetProps> = ({ userId, courses = [] }) => {
  const { savedVideos, isLoaded, removeVideo, saveVideo, isSaved } = useSavedVideos(userId);

  // Available lessons from enrolled courses that can be saved
  const availableLessons = React.useMemo(() => {
    const list: SavedVideo[] = [];
    courses.forEach((c) => {
      c.lessons?.forEach((l) => {
        if (l.type === 'video' || !l.type) {
          list.push({
            id: l.id,
            lessonId: l.id,
            lessonTitle: l.title,
            courseId: c.id,
            courseTitle: c.title,
            courseCode: c.code,
            durationMinutes: l.duration_minutes || (l.duration_seconds ? Math.round(l.duration_seconds / 60) : 45),
            savedAt: new Date().toISOString(),
          });
        }
      });
    });
    return list;
  }, [courses]);

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5 shadow-xs animate-pulse">
        <div className="h-6 w-40 bg-surface-raised rounded mb-4" />
        <div className="h-20 bg-surface-raised rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-warning-subtle text-warning flex items-center justify-center">
            <BookmarkCheckIcon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-fg">الفيديوهات المحفوظة</h2>
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-warning-subtle text-warning">
                {savedVideos.length}
              </span>
            </div>
            <p className="text-xs text-fg-muted mt-0.5">دروسك المفضلة للرجوع إليها والمشاهدة السريعة لاحقاً</p>
          </div>
        </div>
      </div>

      {/* Content */}
      {savedVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {savedVideos.map((item) => (
            <div
              key={item.lessonId}
              className="group relative rounded-md border border-border bg-surface-raised/40 hover:bg-surface-raised/80 hover:border-primary/40 transition-all p-3.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-primary font-mono bg-primary-subtle px-2 py-0.5 rounded">
                    {item.courseCode || 'كورس'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeVideo(item.lessonId)}
                    title="إزالة من المحفوظات"
                    className="text-fg-muted hover:text-danger p-1 rounded hover:bg-surface transition-colors"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>

                <h3 className="text-xs sm:text-sm font-bold text-fg line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                  {item.lessonTitle}
                </h3>
                <p className="text-xs text-fg-muted mt-1 truncate">{item.courseTitle}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                  <ClockIcon size={12} />
                  <span>{item.durationMinutes ? `${item.durationMinutes} دقيقة` : 'غير محدد'}</span>
                </div>

                <Link href={`/student/courses/${item.courseId}/lessons/${item.lessonId}`}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors shadow-2xs"
                  >
                    <PlayIcon size={12} />
                    <span>مشاهدة</span>
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-surface-raised/30 p-5 text-center">
          <div className="w-10 h-10 mx-auto rounded-full bg-warning-subtle text-warning flex items-center justify-center mb-2.5">
            <BookmarkIcon size={20} />
          </div>
          <h3 className="text-sm font-bold text-fg">لا توجد فيديوهات محفوظة بعد</h3>
          <p className="text-xs text-fg-muted mt-1 max-w-md mx-auto">
            يمكنك حفظ أي درس فيديو للمشاهدة لاحقاً بالضغط على زر الحفظ، أو يمكنك البدء بحفظ أحد دروسك المتاحة أدناه:
          </p>

          {availableLessons.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50 max-w-xl mx-auto">
              <p className="text-xs font-semibold text-fg mb-2.5 text-start">دروس مقترحة من مقرراتك الحالية:</p>
              <div className="space-y-2">
                {availableLessons.slice(0, 3).map((lesson) => {
                  const saved = isSaved(lesson.lessonId);
                  return (
                    <div
                      key={lesson.lessonId}
                      className="flex items-center justify-between gap-3 p-2.5 rounded bg-surface border border-border text-start"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-fg truncate">{lesson.lessonTitle}</p>
                        <p className="text-xs text-fg-muted truncate">{lesson.courseTitle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveVideo(lesson)}
                        disabled={saved}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                          saved
                            ? 'bg-success-subtle text-success border border-success/20'
                            : 'bg-primary text-primary-fg hover:bg-primary-hover'
                        }`}
                      >
                        {saved ? (
                          <>
                            <BookmarkCheckIcon size={13} />
                            <span>تم الحفظ</span>
                          </>
                        ) : (
                          <>
                            <BookmarkIcon size={13} />
                            <span>حفظ الفيديو</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
