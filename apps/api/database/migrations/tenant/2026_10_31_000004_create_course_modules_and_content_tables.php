<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations on the tenant database.
     */
    public function up(): void
    {
        // 1. Create course_modules table
        if (! Schema::connection('tenant')->hasTable('course_modules')) {
            Schema::connection('tenant')->create('course_modules', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('course_id')->constrained('courses')->cascadeOnDelete();
                $table->string('title');
                $table->text('description')->nullable();
                $table->integer('sort_order')->default(0);
                $table->string('status', 50)->default('published'); // draft, published
                $table->timestamps();
            });
        }

        // 2. Add columns to courses
        if (Schema::connection('tenant')->hasTable('courses')) {
            Schema::connection('tenant')->table('courses', function (Blueprint $table) {
                if (! Schema::connection('tenant')->hasColumn('courses', 'cover_path')) {
                    $table->string('cover_path')->nullable()->after('description');
                }
                if (! Schema::connection('tenant')->hasColumn('courses', 'level')) {
                    $table->string('level', 50)->nullable()->after('cover_path'); // beginner, intermediate, advanced
                }
                if (! Schema::connection('tenant')->hasColumn('courses', 'published_at')) {
                    $table->timestamp('published_at')->nullable()->after('status');
                }
            });
        }

        // 3. Add columns to lessons
        if (Schema::connection('tenant')->hasTable('lessons')) {
            Schema::connection('tenant')->table('lessons', function (Blueprint $table) {
                if (! Schema::connection('tenant')->hasColumn('lessons', 'module_id')) {
                    $table->foreignUuid('module_id')->nullable()->after('course_id')->constrained('course_modules')->nullOnDelete();
                }
                if (! Schema::connection('tenant')->hasColumn('lessons', 'type')) {
                    $table->string('type', 50)->default('text')->after('title'); // video, document, text, assignment, exam, live
                }
                if (! Schema::connection('tenant')->hasColumn('lessons', 'duration_seconds')) {
                    $table->integer('duration_seconds')->nullable()->after('type');
                }
                if (! Schema::connection('tenant')->hasColumn('lessons', 'ref_id')) {
                    $table->string('ref_id', 100)->nullable()->after('duration_seconds');
                }
                if (! Schema::connection('tenant')->hasColumn('lessons', 'published_at')) {
                    $table->timestamp('published_at')->nullable()->after('status');
                }
            });
        }

        // 4. Create lesson_materials table
        if (! Schema::connection('tenant')->hasTable('lesson_materials')) {
            Schema::connection('tenant')->create('lesson_materials', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('lesson_id')->constrained('lessons')->cascadeOnDelete();
                $table->string('title');
                $table->string('kind', 20)->default('file'); // file, link
                $table->string('storage_path')->nullable();
                $table->text('url')->nullable();
                $table->string('mime', 100)->nullable();
                $table->unsignedBigInteger('size')->nullable();
                $table->integer('sort_order')->default(0);
                $table->timestamps();
            });
        }

        // 5. Backfill: create default module for existing courses and assign unassigned lessons
        $this->backfillExistingLessons();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('lesson_materials');

        if (Schema::connection('tenant')->hasTable('lessons')) {
            Schema::connection('tenant')->table('lessons', function (Blueprint $table) {
                if (Schema::connection('tenant')->hasColumn('lessons', 'published_at')) {
                    $table->dropColumn('published_at');
                }
                if (Schema::connection('tenant')->hasColumn('lessons', 'ref_id')) {
                    $table->dropColumn('ref_id');
                }
                if (Schema::connection('tenant')->hasColumn('lessons', 'duration_seconds')) {
                    $table->dropColumn('duration_seconds');
                }
                if (Schema::connection('tenant')->hasColumn('lessons', 'type')) {
                    $table->dropColumn('type');
                }
                if (Schema::connection('tenant')->hasColumn('lessons', 'module_id')) {
                    $table->dropForeign(['module_id']);
                    $table->dropColumn('module_id');
                }
            });
        }

        if (Schema::connection('tenant')->hasTable('courses')) {
            Schema::connection('tenant')->table('courses', function (Blueprint $table) {
                if (Schema::connection('tenant')->hasColumn('courses', 'published_at')) {
                    $table->dropColumn('published_at');
                }
                if (Schema::connection('tenant')->hasColumn('courses', 'level')) {
                    $table->dropColumn('level');
                }
                if (Schema::connection('tenant')->hasColumn('courses', 'cover_path')) {
                    $table->dropColumn('cover_path');
                }
            });
        }

        Schema::connection('tenant')->dropIfExists('course_modules');
    }

    /**
     * Backfill existing courses with a default module and associate unassigned lessons.
     */
    protected function backfillExistingLessons(): void
    {
        if (! Schema::connection('tenant')->hasTable('courses') || ! Schema::connection('tenant')->hasTable('lessons')) {
            return;
        }

        $courses = DB::connection('tenant')->table('courses')->get();

        foreach ($courses as $course) {
            $unassignedLessons = DB::connection('tenant')
                ->table('lessons')
                ->where('course_id', $course->id)
                ->whereNull('module_id')
                ->get();

            if ($unassignedLessons->isEmpty()) {
                continue;
            }

            $moduleId = (string) Str::uuid();
            DB::connection('tenant')->table('course_modules')->insert([
                'id' => $moduleId,
                'course_id' => $course->id,
                'title' => 'المحتوى الرئيسي',
                'description' => 'الوحدة الأولى للمقرر الدراسي',
                'sort_order' => 1,
                'status' => 'published',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($unassignedLessons as $lesson) {
                // Determine type: if media_assets exists and has video for this lesson, type=video, else text
                $hasVideo = false;
                if (Schema::connection('tenant')->hasTable('media_assets')) {
                    $hasVideo = DB::connection('tenant')
                        ->table('media_assets')
                        ->where('lesson_id', $lesson->id)
                        ->where('media_type', 'video')
                        ->exists();
                }

                DB::connection('tenant')
                    ->table('lessons')
                    ->where('id', $lesson->id)
                    ->update([
                        'module_id' => $moduleId,
                        'type' => $hasVideo ? 'video' : 'text',
                        'updated_at' => now(),
                    ]);
            }
        }
    }
};
