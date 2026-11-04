<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ApiResponse
{
    /**
     * Build a standardized successful response envelope.
     *
     * @param  array<string, mixed>  $extraMeta
     * @param  array<string, string>  $headers
     */
    public static function success(
        mixed $data = null,
        int $status = Response::HTTP_OK,
        array $extraMeta = [],
        array $headers = []
    ): JsonResponse {
        $meta = array_merge([
            'request_id' => self::resolveRequestId(),
            'timestamp' => now()->toIso8601String(),
        ], $extraMeta);

        return response()->json([
            'data' => $data ?? (object) [],
            'meta' => $meta,
        ], $status, $headers);
    }

    /**
     * Build a standardized paginated response envelope.
     */
    public static function paginated(
        LengthAwarePaginator $paginator,
        int $status = Response::HTTP_OK,
        array $headers = []
    ): JsonResponse {
        return self::success(
            $paginator->items(),
            $status,
            [
                'pagination' => [
                    'total' => $paginator->total(),
                    'page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'last_page' => $paginator->lastPage(),
                ],
            ],
            $headers
        );
    }

    /**
     * Build a standardized error response envelope.
     *
     * @param  array<string, mixed>  $details
     * @param  array<string, mixed>  $extraMeta
     * @param  array<string, string>  $headers
     */
    public static function error(
        string $code,
        string $message,
        int $status = Response::HTTP_BAD_REQUEST,
        array $details = [],
        array $extraMeta = [],
        array $headers = []
    ): JsonResponse {
        $meta = array_merge([
            'request_id' => self::resolveRequestId(),
            'timestamp' => now()->toIso8601String(),
        ], $extraMeta);

        return response()->json([
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => (object) $details,
            ],
            'meta' => $meta,
        ], $status, $headers);
    }

    /**
     * Resolve the current request ID from the request attributes, headers, or fallback.
     */
    public static function resolveRequestId(): string
    {
        if (app()->bound('request')) {
            $request = app('request');
            if ($request instanceof Request) {
                $requestId = $request->attributes->get('request_id');
                if (is_string($requestId) && $requestId !== '') {
                    return $requestId;
                }

                $header = $request->header('X-Request-ID');
                if (is_string($header) && $header !== '') {
                    return $header;
                }
            }
        }

        return (string) Str::uuid();
    }
}
