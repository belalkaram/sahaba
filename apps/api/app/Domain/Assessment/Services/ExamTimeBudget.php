<?php

namespace App\Domain\Assessment\Services;

use App\Models\Exam;
use App\Models\ExamAttempt;
use Carbon\CarbonInterface;

/**
 * Server-authoritative time accounting for exams.
 *
 * Single-session exams keep the original rule: the attempt ends at expires_at (start + duration, capped by
 * closes_at). Split-session exams (exam.allow_split_sessions) may be taken in several sittings inside the
 * opens_at..closes_at window, e.g. 30 minutes as 4 x ~7.5 minutes over 4 days: only ACTIVE time counts.
 *
 * Active time is measured from client heartbeats. Each tick charges the time since the previous tick, but at
 * most HEARTBEAT_GRACE_SECONDS, so closing the tab, losing the network or leaving for a day costs at most a
 * short grace - never the whole gap - and a client cannot make the clock run slower than real time by
 * skipping heartbeats while staying on the page (the gap is charged up to the grace each time).
 */
final class ExamTimeBudget
{
    /** Longest gap between two heartbeats that is still charged as active time. */
    public const HEARTBEAT_GRACE_SECONDS = 45;

    /** On resume after being away, at most this much of the gap is charged (the student was not working). */
    public const RESUME_CHARGE_SECONDS = 20;

    public static function budgetSeconds(Exam $exam): int
    {
        return ($exam->duration_minutes ?: 60) * 60;
    }

    public static function usedSeconds(ExamAttempt $attempt): int
    {
        return (int) $attempt->time_used_seconds;
    }

    public static function isExhausted(ExamAttempt $attempt, Exam $exam): bool
    {
        if (self::usedSeconds($attempt) >= self::budgetSeconds($exam)) {
            return true;
        }

        return $exam->closes_at !== null && now()->greaterThan($exam->closes_at);
    }

    /**
     * Seconds the student can still work: the unused budget, never beyond the window closing.
     */
    public static function remainingSeconds(ExamAttempt $attempt, Exam $exam, ?CarbonInterface $now = null): int
    {
        $now ??= now();
        $remaining = self::budgetSeconds($exam) - self::usedSeconds($attempt);

        if ($exam->closes_at !== null) {
            $remaining = min($remaining, (int) $now->diffInSeconds($exam->closes_at, false));
        }

        return max(0, $remaining);
    }

    /**
     * Charge the active time since the last tick and move expires_at to the end of the current sitting.
     * Call on start, resume, heartbeat and before accepting an answer. Idempotent within the same second.
     */
    public static function tick(ExamAttempt $attempt, Exam $exam, ?CarbonInterface $now = null, int $maxCharge = self::HEARTBEAT_GRACE_SECONDS): int
    {
        $now ??= now();

        if ($attempt->last_seen_at !== null) {
            $gap = max(0, (int) $attempt->last_seen_at->diffInSeconds($now, false));
            $attempt->time_used_seconds = self::usedSeconds($attempt) + min($gap, $maxCharge);
        }

        $attempt->last_seen_at = $now;
        $remaining = self::remainingSeconds($attempt, $exam, $now);
        $attempt->expires_at = $now->copy()->addSeconds($remaining);
        $attempt->save();

        return $remaining;
    }
}
