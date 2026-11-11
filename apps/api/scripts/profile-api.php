<?php

/**
 * Dev tool: per-endpoint query count and latency, measured in-process (no HTTP server queueing).
 *
 *   php scripts/profile-api.php [--tenant=almustaqbal] [--only=/courses] [--detail] [--repeat=2]
 *
 * It reads the database configured in .env. It creates one short-lived token per demo user (tenant_tokens rows,
 * removed at the end) and otherwise only sends GET requests. Use it to compare before/after a performance change;
 * the first request of a run also pays the connection handshake, so each endpoint is measured on a warm connection
 * (--repeat=2 reports the second run).
 */

use App\Models\Tenant;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Contracts\Console\Kernel as ConsoleKernel;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$http = $app->make(HttpKernel::class);
$app->make(ConsoleKernel::class)->bootstrap();

$opts = getopt('', ['tenant::', 'only::', 'detail', 'repeat::', 'list']);
$slug = $opts['tenant'] ?? 'almustaqbal';
$only = $opts['only'] ?? null;
$repeat = max(1, (int) ($opts['repeat'] ?? 2));

$tenant = Tenant::where('slug', $slug)->firstOrFail();
app(TenantDatabaseManager::class)->configureConnection($tenant);
app(\App\Tenancy\TenantContext::class)->setTenant($tenant);

$actors = [
    'student' => 'student@almustaqbal.edu',
    'teacher' => 'teacher@almustaqbal.edu',
    'admin' => 'admin@almustaqbal.edu',
];

$tokens = [];
$ids = [];
foreach ($actors as $role => $email) {
    $user = TenantUser::with(['student', 'staff'])->where('email', $email)->first();
    if (! $user) {
        fwrite(STDERR, "skip $role: $email not found\n");

        continue;
    }
    $made = TenantToken::createTokenFor($user, 'profile-api', 30);
    $tokens[$role] = $made['plainTextToken'];
    $ids[$role] = ['student' => $user->student?->id, 'staff' => $user->staff?->id];
}

$plan = [
    'student' => ['/auth/me', '/notifications?page=1', '/courses', '/me/courses', '/students/{student}/dashboard', '/student/academies'],
    'teacher' => ['/auth/me', '/students', '/courses', '/classes', '/notifications?page=1'],
    'admin' => ['/auth/me', '/users?per_page=20', '/students', '/staff', '/registration-requests'],
];

$log = [];
DB::listen(function ($q) use (&$log) {
    $log[] = [$q->connectionName, $q->time, preg_replace('/\s+/', ' ', $q->sql)];
});

$fmt = fn (array $r) => sprintf('%-9s %-34s %4s  %6.2fs  %3d q  %5.2fs sql  %2d writes', ...$r);
echo "tenant=$slug repeat=$repeat (reports the last run)\n";
$totalQ = 0;
$totalT = 0.0;

foreach ($plan as $role => $paths) {
    if (! isset($tokens[$role])) {
        continue;
    }
    foreach ($paths as $path) {
        $real = str_replace('{student}', (string) ($ids[$role]['student'] ?? ''), $path);
        if ($only && ! str_contains($real, $only)) {
            continue;
        }
        for ($i = 0; $i < $repeat; $i++) {
            $log = [];
            $t = microtime(true);
            $req = Request::create('/api/v1'.$real, 'GET', [], [], [], [
                'HTTP_X_TENANT_SLUG' => $slug, 'HTTP_ACCEPT' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer '.$tokens[$role],
            ]);
            $res = $http->handle($req);
            $elapsed = microtime(true) - $t;
        }
        $writes = count(array_filter($log, fn ($l) => preg_match('/^(insert|update|delete)/i', $l[2])));
        $sql = array_sum(array_column($log, 1)) / 1000;
        echo $fmt([$role, $real, $res->getStatusCode(), $elapsed, count($log), $sql, $writes]), "\n";
        $totalQ += count($log);
        $totalT += $elapsed;

        if (isset($opts['list'])) {
            foreach ($log as $i => $l) {
                echo sprintf('   %2d [%s] %5.0fms %s', $i + 1, $l[0], $l[1], substr($l[2], 0, 120)), "
";
            }
        }

        // Repeated statements = the N+1 suspects.
        $norm = [];
        foreach ($log as $l) {
            $key = preg_replace(['/\b[0-9a-f]{8}-[0-9a-f-]{27}\b/', '/\b\d+\b/', '/\(\s*(\?,?\s*)+\)/'], ['?', '?', '(?)'], $l[2]);
            $norm[$key] = ($norm[$key] ?? 0) + 1;
        }
        arsort($norm);
        foreach (array_slice($norm, 0, isset($opts['detail']) ? 12 : 1, true) as $sqlText => $n) {
            if ($n >= 3 || isset($opts['detail'])) {
                echo sprintf('             x%-3d %s', $n, substr($sqlText, 0, 110)), "\n";
            }
        }
    }
}
printf("TOTAL: %d queries, %.1fs\n", $totalQ, $totalT);

// Clean up the tokens this run created.
TenantToken::whereIn('name', ['profile-api'])->delete();
