<?php

namespace App\Domain\Identity\Services;

use App\Jobs\ImportStudentsCsv;
use App\Models\StudentImport;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Throwable;

class StudentImportService
{
    public function __construct(
        protected UserManagementService $userService
    ) {}

    /**
     * Process an uploaded CSV file and import students.
     */
    /**
     * Stores the upload on the private disk and queues the import (R8-3).
     */
    public function importCsv(UploadedFile $file, TenantUser $creator): StudentImport
    {
        $import = StudentImport::create([
            'filename' => $file->getClientOriginalName(),
            'status' => 'queued',
            'results' => [],
            'created_by' => $creator->id,
        ]);

        $tenantId = app(TenantContext::class)->getTenantOrFail()->id;
        $path = $file->storeAs("imports/{$tenantId}", "{$import->id}.csv", 'local');

        ImportStudentsCsv::dispatch($tenantId, $import->id, $path);

        return $import->fresh();
    }

    /**
     * Runs the import: one row failing never stops the others.
     */
    public function process(StudentImport $import, string $path): StudentImport
    {
        $import->update(['status' => 'processing']);
        $creator = TenantUser::find($import->created_by);

        try {
            return $this->processRows($import, (string) Storage::disk('local')->get($path), $creator);
        } catch (Throwable $e) {
            $import->update(['status' => 'failed', 'results' => [['status' => 'failed', 'error' => $e->getMessage()]]]);

            return $import;
        } finally {
            Storage::disk('local')->delete($path); // contains personal data; not needed after import
        }
    }

    private function processRows(StudentImport $import, string $content, ?TenantUser $creator): StudentImport
    {
        // Strip UTF-8 BOM if present
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);

        $lines = preg_split('/\r\n|\r|\n/', trim($content));
        if (empty($lines)) {
            $import->update(['status' => 'completed']);

            return $import;
        }

        // Parse header
        $headerLine = array_shift($lines);
        $delimiter = str_contains($headerLine, ';') ? ';' : ',';
        $headers = array_map(fn ($h) => strtolower(trim($h, " \t\n\r\0\x0B\"'")), str_getcsv($headerLine, $delimiter));

        $results = [];
        $successCount = 0;
        $failedCount = 0;
        $rowNumber = 1;

        foreach ($lines as $line) {
            $rowNumber++;
            if (empty(trim($line))) {
                continue;
            }

            $values = str_getcsv($line, $delimiter);
            $row = [];
            foreach ($headers as $index => $header) {
                $row[$header] = isset($values[$index]) ? trim($values[$index], " \t\n\r\0\x0B\"'") : null;
            }

            // Normalize column names
            $name = $row['name'] ?? $row['الاسم'] ?? null;
            $phone = $row['phone'] ?? $row['الهاتف'] ?? $row['الجوال'] ?? null;
            $email = $row['email'] ?? $row['البريد'] ?? null;
            $grade = $row['grade_level'] ?? $row['grade'] ?? $row['الصف'] ?? null;
            $parentName = $row['parent_name'] ?? $row['اسم_ولي_الأمر'] ?? null;
            $parentPhone = $row['parent_phone'] ?? $row['هاتف_ولي_الأمر'] ?? null;

            if (empty($name)) {
                $results[] = [
                    'row' => $rowNumber,
                    'status' => 'failed',
                    'error' => 'حقل الاسم مطلوب (Name is required).',
                ];
                $failedCount++;

                continue;
            }

            try {
                $student = $this->userService->createStudent([
                    'name' => $name,
                    'phone' => $phone ?: null,
                    'email' => $email ?: null,
                    'grade_level' => $grade ?: null,
                    'parent_name' => $parentName ?: null,
                    'parent_phone' => $parentPhone ?: null,
                ], $creator);

                $results[] = [
                    'row' => $rowNumber,
                    'status' => 'success',
                    'student_id' => $student->id,
                    'student_code' => $student->student_code,
                    'name' => $student->user->name,
                ];
                $successCount++;
            } catch (\Exception $e) {
                $results[] = [
                    'row' => $rowNumber,
                    'status' => 'failed',
                    'error' => $e->getMessage(),
                ];
                $failedCount++;
            }
        }

        $import->update([
            'total_rows' => $successCount + $failedCount,
            'processed_rows' => $successCount + $failedCount,
            'successful_rows' => $successCount,
            'failed_rows' => $failedCount,
            'status' => 'completed',
            'results' => $results,
        ]);

        return $import;
    }
}
