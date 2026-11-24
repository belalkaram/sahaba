<?php

namespace App\Http\Controllers\Api\Integration;

use App\Domain\Integrations\Exceptions\ProviderException;
use App\Domain\Integrations\Exceptions\ProviderTimeoutException;
use App\Domain\Integrations\Google\Drive\StorageFullException;
use App\Domain\Integrations\Google\GoogleNotConnectedException;
use App\Domain\Integrations\Media\MediaUploadService;
use App\Domain\Integrations\Media\UploadIncompleteException;
use App\Http\Controllers\Controller;
use App\Models\MediaUpload;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Direct, resumable uploads to Google Drive (ADR-008, ADR-009): start a session, ask how far it got, then complete
 * it. Only the uploader can see or complete an upload.
 */
class MediaUploadController extends Controller
{
    public function __construct(private readonly MediaUploadService $uploads) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'file_name' => 'required|string|max:255',
            'mime_type' => ['required', 'string', 'max:120', 'regex:#^video/[a-z0-9.+-]+$#i'],
            'size_bytes' => 'required|integer|min:1|max:'.config('services.google.upload_max_bytes'),
            'course_id' => 'nullable|uuid|exists:tenant.courses,id',
            'lesson_id' => 'nullable|uuid|exists:tenant.lessons,id',
        ]);

        /** @var TenantUser $user */
        $user = $request->user();

        return $this->guard(function () use ($validated, $user, $request) {
            $upload = $this->uploads->start($validated + ['media_type' => 'video'], $user, $request->headers->get('Origin'));

            return ApiResponse::success([
                'upload_id' => $upload->id,
                // Only the uploader receives this; it can write into the academy folder until the file is complete.
                'upload_url' => $upload->session_url,
                'expires_at' => $upload->expires_at?->toIso8601String(),
                'upload' => $this->uploads->present($upload),
            ], Response::HTTP_CREATED);
        });
    }

    /** Status, plus how many bytes Google holds while pending, so the browser resumes from there. */
    public function show(Request $request, string $id): JsonResponse
    {
        $upload = MediaUpload::query()->findOrFail($id);
        if ($denied = $this->ownerOnly($request, $upload)) {
            return $denied;
        }

        return $this->guard(function () use ($upload) {
            $progress = $upload->status === MediaUpload::PENDING ? $this->uploads->progress($upload) : null;

            return ApiResponse::success(['upload' => $this->uploads->present($upload, $progress)]);
        });
    }

    public function complete(Request $request, string $id): JsonResponse
    {
        $upload = MediaUpload::query()->findOrFail($id);
        if ($denied = $this->ownerOnly($request, $upload)) {
            return $denied;
        }

        return $this->guard(function () use ($upload) {
            try {
                $upload = $this->uploads->requestCompletion($upload);
            } catch (UploadIncompleteException) {
                return ApiResponse::error('UPLOAD_INCOMPLETE', 'لم يكتمل رفع الملف بعد.', Response::HTTP_CONFLICT);
            }

            $payload = $this->uploads->present($upload);
            if ($upload->status === MediaUpload::FAILED) {
                return ApiResponse::error('INVALID_UPLOAD', 'رُفض الملف المرفوع ('.$upload->failure_reason.').', Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            // 201 once the worker has registered the asset (always so with the sync queue); 202 while it works.
            return $upload->status === MediaUpload::COMPLETED
                ? ApiResponse::success(['upload' => $payload, 'media_asset' => $payload['media_asset'] ?? null], Response::HTTP_CREATED)
                : ApiResponse::success(['upload' => $payload], Response::HTTP_ACCEPTED);
        });
    }

    private function ownerOnly(Request $request, MediaUpload $upload): ?JsonResponse
    {
        return $upload->created_by === $request->user()->id
            ? null
            : ApiResponse::error('FORBIDDEN', 'هذا الرفع يخص مستخدماً آخر.', Response::HTTP_FORBIDDEN);
    }

    private function guard(callable $action): JsonResponse
    {
        try {
            return $action();
        } catch (StorageFullException) {
            return ApiResponse::error('STORAGE_FULL', 'لا توجد مساحة كافية في حسابات التخزين لهذا الملف. تواصل مع إدارة المنصة.', Response::HTTP_CONFLICT);
        } catch (GoogleNotConnectedException) {
            return ApiResponse::error('GOOGLE_NOT_CONNECTED', 'لا يوجد تخزين Google Drive متاح. اربط حساب Google من إعدادات التكاملات.', Response::HTTP_CONFLICT);
        } catch (ProviderTimeoutException $e) {
            return ApiResponse::error('PROVIDER_TIMEOUT', $e->getMessage(), Response::HTTP_GATEWAY_TIMEOUT);
        } catch (ProviderException $e) {
            return $e->getCode() === 422
                ? ApiResponse::error('INVALID_UPLOAD', $e->getMessage(), Response::HTTP_UNPROCESSABLE_ENTITY)
                : ApiResponse::error('PROVIDER_ERROR', $e->getMessage(), Response::HTTP_BAD_GATEWAY);
        }
    }
}
