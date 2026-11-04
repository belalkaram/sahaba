<?php

namespace App\Http\Controllers\Api\Identity;

use App\Domain\Identity\Services\StudentImportService;
use App\Http\Controllers\Controller;
use App\Models\StudentImport;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StudentImportController extends Controller
{
    public function __construct(
        protected StudentImportService $importService
    ) {}

    /**
     * Import students from an uploaded CSV file.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('students.create')) {
            throw new AuthorizationException('Forbidden. You do not have permission to import students.');
        }

        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:5120',
        ]);

        $import = $this->importService->importCsv($request->file('file'), $user);

        return ApiResponse::success(['import' => $import], Response::HTTP_CREATED);
    }

    /**
     * Show import results.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('students.view') && ! $user->hasPermissionTo('students.create')) {
            throw new AuthorizationException('Forbidden. You do not have permission to view import results.');
        }

        $import = StudentImport::with('creator')->findOrFail($id);

        return ApiResponse::success(['import' => $import]);
    }

    /**
     * List all student imports.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('students.view') && ! $user->hasPermissionTo('students.create')) {
            throw new AuthorizationException('Forbidden. You do not have permission to view imports.');
        }

        $imports = StudentImport::with('creator')->orderBy('created_at', 'desc')->get();

        return ApiResponse::success(['imports' => $imports]);
    }
}
