'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SavedVideo {
  id: string; // matches lessonId
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  courseCode?: string;
  durationMinutes?: number;
  savedAt: string; // ISO date string
  progressPercent?: number;
}

const STORAGE_PREFIX = 'sahaba_saved_videos_';
const CUSTOM_EVENT_NAME = 'lms:saved-videos-updated';

function getStorageKey(userId?: string): string {
  return `${STORAGE_PREFIX}${userId || 'guest'}`;
}

export function getSavedVideosFromStorage(userId?: string): SavedVideo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedVideosToStorage(videos: SavedVideo[], userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(videos));
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: { userId, count: videos.length } }));
  } catch (err) {
    console.error('Failed to save videos to localStorage', err);
  }
}

export function useSavedVideos(userId?: string) {
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const reload = useCallback(() => {
    const list = getSavedVideosFromStorage(userId);
    setSavedVideos(list);
    setIsLoaded(true);
  }, [userId]);

  useEffect(() => {
    reload();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === getStorageKey(userId)) {
        reload();
      }
    };

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || customEvent.detail.userId === userId) {
        reload();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(CUSTOM_EVENT_NAME, handleCustomChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomChange);
    };
  }, [userId, reload]);

  const isSaved = useCallback(
    (lessonId: string): boolean => {
      return savedVideos.some((v) => v.lessonId === lessonId || v.id === lessonId);
    },
    [savedVideos]
  );

  const saveVideo = useCallback(
    (video: SavedVideo) => {
      const current = getSavedVideosFromStorage(userId);
      const exists = current.some((v) => v.lessonId === video.lessonId || v.id === video.lessonId);
      if (exists) return;

      const updated = [
        {
          ...video,
          id: video.lessonId,
          savedAt: video.savedAt || new Date().toISOString(),
        },
        ...current,
      ];
      writeSavedVideosToStorage(updated, userId);
      setSavedVideos(updated);
    },
    [userId]
  );

  const removeVideo = useCallback(
    (lessonId: string) => {
      const current = getSavedVideosFromStorage(userId);
      const updated = current.filter((v) => v.lessonId !== lessonId && v.id !== lessonId);
      writeSavedVideosToStorage(updated, userId);
      setSavedVideos(updated);
    },
    [userId]
  );

  const toggleVideo = useCallback(
    (video: SavedVideo): boolean => {
      const current = getSavedVideosFromStorage(userId);
      const existsIndex = current.findIndex((v) => v.lessonId === video.lessonId || v.id === video.lessonId);

      if (existsIndex >= 0) {
        const updated = current.filter((_, idx) => idx !== existsIndex);
        writeSavedVideosToStorage(updated, userId);
        setSavedVideos(updated);
        return false;
      } else {
        const updated = [
          {
            ...video,
            id: video.lessonId,
            savedAt: new Date().toISOString(),
          },
          ...current,
        ];
        writeSavedVideosToStorage(updated, userId);
        setSavedVideos(updated);
        return true;
      }
    },
    [userId]
  );

  return {
    savedVideos,
    isLoaded,
    isSaved,
    saveVideo,
    removeVideo,
    toggleVideo,
  };
}
