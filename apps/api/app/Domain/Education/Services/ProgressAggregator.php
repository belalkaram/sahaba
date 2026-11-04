<?php

namespace App\Domain\Education\Services;

use App\Models\AbuseSignal;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Student;
use App\Models\VideoEvent;

class ProgressAggregator
{
    /**
     * Process a batch of video events for a student and update progress.
     *
     * @param  array<array{type: string, position_seconds: float, client_ts?: int}>  $events
     */
    public function processBatch(Student $student, Lesson $lesson, array $events): LessonProgress
    {
        $duration = $lesson->duration_seconds ?: 60; // fallback duration if not set
        $now = now();

        $progress = LessonProgress::firstOrCreate(
            [
                'student_id' => $student->id,
                'lesson_id' => $lesson->id,
            ],
            [
                'percent' => 0,
                'last_position_seconds' => 0,
                'completed_at' => null,
                'watch_seconds' => 0,
                'rewatch_count' => 0,
            ]
        );

        $maxPosition = (float) $progress->last_position_seconds;
        $totalWatchIncrement = 0;
        $lastPos = $maxPosition;

        foreach ($events as $event) {
            $type = $event['type'] ?? 'heartbeat';
            $pos = (float) ($event['position_seconds'] ?? 0);

            // Record event into database
            VideoEvent::create([
                'student_id' => $student->id,
                'lesson_id' => $lesson->id,
                'media_id' => null,
                'type' => $type,
                'position_seconds' => $pos,
                'client_ts' => $event['client_ts'] ?? null,
                'created_at' => $now,
            ]);

            // Detect abuse: impossible seek leap forward
            if ($pos > $lastPos + 60 && $type === 'heartbeat') {
                AbuseSignal::create([
                    'student_id' => $student->id,
                    'lesson_id' => $lesson->id,
                    'signal_type' => 'speed_anomaly',
                    'severity' => 'warning',
                    'payload' => [
                        'from_position' => $lastPos,
                        'to_position' => $pos,
                        'type' => $type,
                    ],
                    'created_at' => $now,
                ]);
            }

            if ($type === 'heartbeat') {
                $totalWatchIncrement += 15; // standard 15s interval
            }

            if ($pos > $maxPosition) {
                $maxPosition = $pos;
            }
            $lastPos = $pos;
        }

        $calculatedPercent = (int) min(100, round(($maxPosition / max(1, $duration)) * 100));
        $newPercent = max($progress->percent, $calculatedPercent);

        $isCompleted = $newPercent >= 90;
        $completedAt = $progress->completed_at;
        if ($isCompleted && ! $completedAt) {
            $completedAt = $now;
        }

        $progress->update([
            'percent' => $newPercent,
            'last_position_seconds' => (int) $lastPos,
            'completed_at' => $completedAt,
            'watch_seconds' => $progress->watch_seconds + $totalWatchIncrement,
        ]);

        return $progress->fresh();
    }
}
