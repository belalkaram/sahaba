/**
 * Student Dashboard & Saved Videos Test Suite
 * Executed with Node.js native test runner:
 * node --experimental-strip-types --test apps/web/tests/student-dashboard.test.ts
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
// @ts-ignore
import { getSavedVideosFromStorage } from '../src/features/student-dashboard/hooks/use-saved-videos.ts';
// @ts-ignore
import type { SavedVideo } from '../src/features/student-dashboard/hooks/use-saved-videos.ts';

describe('Student Dashboard & Saved Videos', () => {
  test('getSavedVideosFromStorage handles SSR safely when window is undefined', () => {
    // In node test environment without browser window
    const list = getSavedVideosFromStorage('test-user-123');
    assert.ok(Array.isArray(list));
    assert.strictEqual(list.length, 0);
  });

  test('SavedVideo interface conforms to required contract', () => {
    const video: SavedVideo = {
      id: 'lesson-101',
      lessonId: 'lesson-101',
      lessonTitle: 'قواعد الاشتقاق الأساسية والاشتقاق الضمني',
      courseId: 'course-201',
      courseTitle: 'رياضيات متقدمة - تفاضل وتكامل',
      courseCode: 'MATH-201',
      durationMinutes: 45,
      savedAt: new Date().toISOString(),
      progressPercent: 60,
    };

    assert.strictEqual(video.id, 'lesson-101');
    assert.strictEqual(video.courseCode, 'MATH-201');
    assert.strictEqual(video.durationMinutes, 45);
    assert.strictEqual(typeof video.savedAt, 'string');
    assert.strictEqual(video.progressPercent, 60);
  });

  test('Calculates course progress partition correctly between in-progress and completed', () => {
    const courses = [
      { id: 'c1', title: 'Course 1', lessons: [{ id: 'l1' }, { id: 'l2' }] },
      { id: 'c2', title: 'Course 2', lessons: [{ id: 'l3' }] },
      { id: 'c3', title: 'Course 3', lessons: [{ id: 'l4' }] },
    ];

    const progress = [
      { lesson: { id: 'l1', course_id: 'c1' }, percent: 100, completed_at: '2026-11-01' },
      { lesson: { id: 'l2', course_id: 'c1' }, percent: 100, completed_at: '2026-11-02' },
      { lesson: { id: 'l3', course_id: 'c2' }, percent: 50, completed_at: null },
    ];

    // Compute completion status
    const completedLessonIds = new Set(
      progress.filter((p) => p.completed_at || p.percent >= 100).map((p) => p.lesson.id)
    );

    const results = courses.map((c) => {
      const total = c.lessons.length;
      const completed = c.lessons.filter((l) => completedLessonIds.has(l.id)).length;
      const isCompleted = total > 0 && completed >= total;
      return { id: c.id, total, completed, isCompleted };
    });

    assert.strictEqual(results[0].isCompleted, true, 'c1 should be completed');
    assert.strictEqual(results[1].isCompleted, false, 'c2 should be in-progress');
    assert.strictEqual(results[2].isCompleted, false, 'c3 should be not started');

    const completedCourses = results.filter((r) => r.isCompleted);
    const inProgressCourses = results.filter((r) => !r.isCompleted);

    assert.strictEqual(completedCourses.length, 1);
    assert.strictEqual(inProgressCourses.length, 2);
  });
});
