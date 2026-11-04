<?php

/**
 * R9-2: documents every API route in docs/backend/openapi.yaml.
 *
 *   php scripts/generate-openapi.php   (from apps/api)
 *
 * Routes already documented by hand keep their entry. Missing ones are generated from the router:
 * method, path, path parameters, auth (from middleware) and required permission. Response bodies
 * of generated entries use the standard envelope; hand-written entries carry the details.
 * Generated blocks live between the markers below and are rewritten on each run.
 */

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Route;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$specPath = realpath(__DIR__.'/../../../docs/backend/openapi.yaml');
$spec = str_replace("\r\n", "\n", file_get_contents($specPath));

const BEGIN = '  # BEGIN GENERATED ROUTES (scripts/generate-openapi.php)';
const END = '  # END GENERATED ROUTES';

// Drop the previous generated block.
$spec = preg_replace('/'.preg_quote(BEGIN, '/').'.*?'.preg_quote(END, '/')."\n/s", '', $spec);

// What the hand-written part documents: path => methods.
preg_match('/^paths:\n(.*?)(?=^\S|\z)/ms', $spec, $match);
$documented = [];
$current = null;
foreach (explode("\n", $match[1] ?? '') as $line) {
    if (preg_match('/^  (\/\S*):\s*$/', $line, $m)) {
        $current = preg_replace('/\{[^}]+\}/', '{}', $m[1]);
    } elseif ($current && preg_match('/^    (get|post|put|patch|delete):/', $line, $m)) {
        $documented[$current][] = $m[1];
    }
}

$generated = [];
foreach (Route::getRoutes() as $route) {
    if (! str_starts_with($route->uri(), 'api/v1/')) {
        continue;
    }

    $path = '/'.substr($route->uri(), strlen('api/v1/'));
    $key = preg_replace('/\{[^}]+\}/', '{}', $path);

    foreach ($route->methods() as $method) {
        $method = strtolower($method);
        if ($method === 'head' || in_array($method, $documented[$key] ?? [], true)) {
            continue;
        }

        $middleware = $route->gatherMiddleware();
        $permissions = [];
        $auth = 'public';
        foreach ($middleware as $name) {
            if (! is_string($name)) {
                continue;
            }
            if (str_starts_with($name, 'tenant.can:')) {
                $permissions[] = substr($name, strlen('tenant.can:'));
            }
            if (in_array($name, ['tenant.auth', 'platform.auth'], true)) {
                $auth = $name;
            }
        }

        $generated[$path][$method] = [
            'summary' => str_replace('api.', '', (string) $route->getName()),
            'auth' => $auth,
            'permissions' => $permissions,
            'params' => $route->parameterNames(),
        ];
    }
}

ksort($generated);

$yaml = BEGIN."\n";
foreach ($generated as $path => $methods) {
    $yaml .= "  {$path}:\n";
    foreach ($methods as $method => $info) {
        $yaml .= "    {$method}:\n";
        $yaml .= '      summary: '.json_encode($info['summary'], JSON_UNESCAPED_SLASHES)."\n";
        $description = 'Auth: '.$info['auth'].($info['permissions'] ? '. Permission: '.implode(', ', $info['permissions']) : '').'.';
        $yaml .= '      description: '.json_encode($description, JSON_UNESCAPED_SLASHES)."\n";
        if ($info['auth'] === 'public') {
            $yaml .= "      security: []\n";
        }
        if ($info['params']) {
            $yaml .= "      parameters:\n";
            foreach ($info['params'] as $param) {
                $yaml .= "        - { name: {$param}, in: path, required: true, schema: { type: string } }\n";
            }
        }
        $yaml .= "      responses:\n";
        $yaml .= "        '200':\n          description: Standard success envelope { data, meta }\n";
        $yaml .= "        default:\n          description: Standard error envelope { error, meta }\n";
    }
}
$yaml .= END."\n";

// Insert right after `paths:` so the generated block never splits a hand-written path.
$spec = preg_replace('/^paths:\n/m', "paths:\n".addcslashes($yaml, '\\$'), $spec, 1);
$spec = str_replace(['Madar LMS API', 'the Madar Multi-Tenant LMS'], ['Sahaba API', 'the Sahaba multi-tenant'], $spec);

file_put_contents($specPath, $spec);

echo 'Generated '.array_sum(array_map('count', $generated))." route entries\n";
