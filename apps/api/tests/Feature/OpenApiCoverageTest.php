<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * R9-2: fails when an API route is missing from docs/backend/openapi.yaml.
 * Fix by running: php scripts/generate-openapi.php
 */
class OpenApiCoverageTest extends TestCase
{
    public function test_every_api_route_is_documented(): void
    {
        $spec = str_replace("\r\n", "\n", file_get_contents(base_path('../../docs/backend/openapi.yaml')));

        $documented = [];
        $current = null;
        foreach (explode("\n", $spec) as $line) {
            if (preg_match('/^  (\/\S*):\s*$/', $line, $m)) {
                $current = preg_replace('/\{[^}]+\}/', '{}', $m[1]);
            } elseif ($current && preg_match('/^    (get|post|put|patch|delete):/', $line, $m)) {
                $documented[$current][] = $m[1];
            }
        }

        $missing = [];
        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/v1/')) {
                continue;
            }
            $key = preg_replace('/\{[^}]+\}/', '{}', '/'.substr($route->uri(), strlen('api/v1/')));
            foreach ($route->methods() as $method) {
                $method = strtolower($method);
                if ($method !== 'head' && ! in_array($method, $documented[$key] ?? [], true)) {
                    $missing[] = strtoupper($method).' '.$route->uri();
                }
            }
        }

        $this->assertSame([], $missing, 'Undocumented routes. Run: php scripts/generate-openapi.php');
    }
}
