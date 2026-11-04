<?php

use App\Http\Middleware\PlatformAuthenticate;
use App\Http\Middleware\RequestCorrelationMiddleware;
use App\Http\Middleware\TenantAuthenticate;
use App\Http\Middleware\TenantAuthorize;
use App\Http\Middleware\TenantModuleMiddleware;
use App\Http\Middleware\TenantResolutionMiddleware;
use App\Support\ApiResponse;
use App\Tenancy\Exceptions\TenantInactiveException;
use App\Tenancy\Exceptions\TenantNotFoundException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api/v1',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(RequestCorrelationMiddleware::class);
        $middleware->alias([
            'tenant' => TenantResolutionMiddleware::class,
            'tenant.auth' => TenantAuthenticate::class,
            'tenant.can' => TenantAuthorize::class,
            'tenant.module' => TenantModuleMiddleware::class, // R1-A5: Organization module gate
            'platform.auth' => PlatformAuthenticate::class,   // R0-1 interim; replaced by real platform tokens in R1-A9
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (TenantNotFoundException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    code: 'TENANT_NOT_FOUND',
                    message: $e->getMessage() ?: 'The requested tenant could not be found.',
                    status: Response::HTTP_NOT_FOUND
                );
            }
        });

        $exceptions->render(function (TenantInactiveException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    code: 'TENANT_INACTIVE',
                    message: $e->getMessage() ?: 'The tenant account is currently inactive.',
                    status: Response::HTTP_FORBIDDEN
                );
            }
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    code: 'VALIDATION_FAILED',
                    message: 'The given data was invalid.',
                    status: Response::HTTP_UNPROCESSABLE_ENTITY,
                    details: $e->errors()
                );
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    code: 'UNAUTHENTICATED',
                    message: $e->getMessage() ?: 'Unauthenticated.',
                    status: Response::HTTP_UNAUTHORIZED
                );
            }
        });

        $exceptions->render(function (AuthorizationException|AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    code: 'FORBIDDEN',
                    message: $e->getMessage() ?: 'This action is unauthorized.',
                    status: Response::HTTP_FORBIDDEN
                );
            }
        });

        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'The requested resource was not found.',
                    status: Response::HTTP_NOT_FOUND
                );
            }
        });

        $exceptions->render(function (MethodNotAllowedHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    code: 'METHOD_NOT_ALLOWED',
                    message: $e->getMessage() ?: 'Method not allowed for this route.',
                    status: Response::HTTP_METHOD_NOT_ALLOWED
                );
            }
        });

        $exceptions->render(function (ThrottleRequestsException|TooManyRequestsHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests. Please try again later.',
                    status: Response::HTTP_TOO_MANY_REQUESTS
                );
            }
        });

        $exceptions->render(function (HttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $status = $e->getStatusCode();
                $code = match ($status) {
                    400 => 'BAD_REQUEST',
                    401 => 'UNAUTHENTICATED',
                    403 => 'FORBIDDEN',
                    404 => 'RESOURCE_NOT_FOUND',
                    405 => 'METHOD_NOT_ALLOWED',
                    409 => 'CONFLICT',
                    422 => 'VALIDATION_FAILED',
                    429 => 'RATE_LIMIT_EXCEEDED',
                    default => 'HTTP_ERROR_'.$status,
                };

                return ApiResponse::error(
                    code: $code,
                    message: $e->getMessage() ?: Response::$statusTexts[$status] ?? 'HTTP Error',
                    status: $status
                );
            }
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $debug = config('app.debug', false);

                return ApiResponse::error(
                    code: 'INTERNAL_SERVER_ERROR',
                    message: $debug ? $e->getMessage() : 'An unexpected server error occurred.',
                    status: Response::HTTP_INTERNAL_SERVER_ERROR,
                    details: $debug ? [
                        'exception' => get_class($e),
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                    ] : []
                );
            }
        });
    })->create();
