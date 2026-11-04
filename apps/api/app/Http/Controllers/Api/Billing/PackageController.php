<?php

namespace App\Http\Controllers\Api\Billing;

use App\Http\Controllers\Controller;
use App\Models\Package;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PackageController extends Controller
{
    /**
     * List packages.
     */
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status', 'active');
        $query = Package::with('entitlements');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $packages = $query->get();

        return ApiResponse::success(['packages' => $packages]);
    }

    /**
     * Create a package.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'billing_cycle' => 'nullable|string|in:monthly,term,yearly',
            'entitlements' => 'nullable|array',
            'entitlements.*' => 'string',
        ]);

        $package = Package::create([
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'description' => $validated['description'] ?? null,
            'price' => $validated['price'],
            'currency' => $validated['currency'] ?? 'EGP',
            'billing_cycle' => $validated['billing_cycle'] ?? 'monthly',
            'status' => 'active',
        ]);

        if (! empty($validated['entitlements'])) {
            foreach ($validated['entitlements'] as $key) {
                $package->entitlements()->create([
                    'entitlement_key' => $key,
                    'value' => 'enabled',
                ]);
            }
        }

        AuditLogger::log(
            action: 'package.created',
            entityType: 'Package',
            entityId: $package->id,
            payload: ['name' => $package->name, 'price' => $package->price]
        );

        return ApiResponse::success(['package' => $package->load('entitlements')], Response::HTTP_CREATED);
    }

    /**
     * Show a package.
     */
    public function show(string $id): JsonResponse
    {
        $package = Package::with('entitlements')->findOrFail($id);

        return ApiResponse::success(['package' => $package]);
    }

    /**
     * Update an existing package and its entitlements (R3-4).
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $package = Package::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'price' => 'sometimes|required|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'billing_cycle' => 'nullable|string|in:monthly,term,yearly',
            'status' => 'nullable|string|in:active,archived',
            'entitlements' => 'nullable|array',
            'entitlements.*' => 'string',
        ]);

        $package->update(array_filter([
            'name' => $validated['name'] ?? null,
            'code' => $validated['code'] ?? null,
            'description' => $validated['description'] ?? null,
            'price' => $validated['price'] ?? null,
            'currency' => $validated['currency'] ?? null,
            'billing_cycle' => $validated['billing_cycle'] ?? null,
            'status' => $validated['status'] ?? null,
        ], fn ($val) => $val !== null));

        if (array_key_exists('entitlements', $validated)) {
            $package->entitlements()->delete();
            if (! empty($validated['entitlements'])) {
                foreach ($validated['entitlements'] as $key) {
                    $package->entitlements()->create([
                        'entitlement_key' => $key,
                        'value' => 'enabled',
                    ]);
                }
            }
        }

        AuditLogger::log(
            action: 'package.updated',
            entityType: 'Package',
            entityId: $package->id,
            payload: $validated
        );

        return ApiResponse::success(['package' => $package->fresh()->load('entitlements')]);
    }

    /**
     * Archive a package (R3-4).
     */
    public function archive(string $id): JsonResponse
    {
        $package = Package::findOrFail($id);
        $package->update(['status' => 'archived']);

        AuditLogger::log(
            action: 'package.archived',
            entityType: 'Package',
            entityId: $package->id
        );

        return ApiResponse::success([
            'message' => 'Package archived successfully.',
            'package' => $package->fresh(),
        ]);
    }
}
