<?php

namespace App\Domain\Integrations\Google;

use App\Domain\Integrations\Exceptions\ProviderException;
use App\Domain\Integrations\Exceptions\ProviderTimeoutException;
use App\Domain\Integrations\Google\Drive\DriveAccess;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Google Drive v3 REST calls (ADR-008, ADR-009). Every call names the Drive it acts on: the academy's own
 * connection or a platform storage account.
 */
class GoogleDriveClient
{
    public const API = 'https://www.googleapis.com/drive/v3';

    public const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

    public const FILE_FIELDS = 'id,name,mimeType,size,trashed,parents,videoMediaMetadata';

    public function createFolder(DriveAccess $access, string $name, ?string $parentId = null): string
    {
        $body = ['name' => $name, 'mimeType' => 'application/vnd.google-apps.folder'];
        if ($parentId) {
            $body['parents'] = [$parentId];
        }

        return (string) $this->send($access, fn (PendingRequest $http) => $http->post(self::API.'/files?fields=id', $body))->json('id');
    }

    /** An existing folder that is not in the trash. */
    public function folderUsable(DriveAccess $access, ?string $folderId): bool
    {
        if (! $folderId) {
            return false;
        }
        $folder = $this->getFile($access, $folderId, 'id,trashed');

        return $folder !== null && ! ($folder['trashed'] ?? false);
    }

    /** Open a resumable session; the browser then PUTs the bytes straight to Google. */
    public function startResumableUpload(DriveAccess $access, string $folderId, string $name, string $mimeType, int $size, ?string $origin): string
    {
        $response = $this->send($access, function (PendingRequest $http) use ($folderId, $name, $mimeType, $size, $origin) {
            $headers = ['X-Upload-Content-Type' => $mimeType, 'X-Upload-Content-Length' => (string) $size];
            if ($origin) {
                $headers['Origin'] = $origin; // Google then answers the browser's CORS requests for this session
            }

            return $http->withHeaders($headers)->post(self::UPLOAD_API.'?uploadType=resumable&fields='.self::FILE_FIELDS, [
                'name' => $name,
                'mimeType' => $mimeType,
                'parents' => [$folderId],
            ]);
        });

        $location = $response->header('Location');
        if (! $location) {
            throw new ProviderException('Google did not return an upload session.', 'google_drive');
        }

        return $location;
    }

    /**
     * Ask the session how many bytes Google holds. `file` is set once every byte arrived.
     *
     * @return array{complete: bool, received_bytes: int, file: array<string, mixed>|null}
     */
    public function resumableStatus(DriveAccess $access, string $sessionUrl, int $size): array
    {
        try {
            $response = Http::withToken($access->accessToken())
                ->withHeaders(['Content-Range' => 'bytes */'.$size])
                ->timeout(20)
                ->withBody('', 'application/octet-stream')
                ->put($sessionUrl);
        } catch (ConnectionException $e) {
            throw new ProviderTimeoutException('Google Drive did not answer.', 'google_drive', 504, $e);
        }

        if (in_array($response->status(), [200, 201], true) && $response->json('id')) {
            return ['complete' => true, 'received_bytes' => $size, 'file' => $response->json()];
        }

        if ($response->status() === 308) {
            // "Range: bytes=0-N" means N+1 bytes arrived; no header means nothing arrived yet.
            $received = preg_match('/bytes=0-(\d+)/', (string) $response->header('Range'), $m) ? ((int) $m[1]) + 1 : 0;

            return ['complete' => false, 'received_bytes' => $received, 'file' => null];
        }

        throw new ProviderException('Google Drive upload session is no longer valid ('.$response->status().').', 'google_drive');
    }

    /**
     * @return array<string, mixed>|null null when the file does not exist or these credentials cannot see it
     */
    public function getFile(DriveAccess $access, string $fileId, string $fields = self::FILE_FIELDS): ?array
    {
        try {
            $response = Http::withToken($access->accessToken())->acceptJson()->timeout(15)
                ->get(self::API.'/files/'.rawurlencode($fileId), ['fields' => $fields, 'supportsAllDrives' => 'true']);
        } catch (ConnectionException $e) {
            throw new ProviderTimeoutException('Google Drive did not answer.', 'google_drive', 504, $e);
        }

        if (in_array($response->status(), [403, 404], true)) {
            return null;
        }

        $this->assertOk($response);

        return $response->json();
    }

    /** Needed for the /preview iframe: students do not sign in to Google (ADR-008, Sharing). */
    public function shareAnyoneWithLink(DriveAccess $access, string $fileId): void
    {
        $this->send($access, fn (PendingRequest $http) => $http->post(
            self::API.'/files/'.rawurlencode($fileId).'/permissions?fields=id',
            ['type' => 'anyone', 'role' => 'reader', 'allowFileDiscovery' => false],
        ));
    }

    /**
     * Account storage as Google reports it (ADR-009). `limit` is null for unlimited plans.
     *
     * @return array{limit: int|null, usage: int}
     */
    public function storageQuota(DriveAccess $access): array
    {
        $quota = $this->send($access, fn (PendingRequest $http) => $http->get(self::API.'/about', ['fields' => 'storageQuota']))
            ->json('storageQuota') ?? [];

        return [
            'limit' => isset($quota['limit']) ? (int) $quota['limit'] : null,
            'usage' => (int) ($quota['usage'] ?? 0),
        ];
    }

    private function send(DriveAccess $access, callable $call): Response
    {
        try {
            $response = $call(Http::withToken($access->accessToken())->acceptJson()->timeout(20));
        } catch (ConnectionException $e) {
            throw new ProviderTimeoutException('Google Drive did not answer.', 'google_drive', 504, $e);
        }

        $this->assertOk($response);

        return $response;
    }

    private function assertOk(Response $response): void
    {
        if ($response->status() === 401) {
            throw new GoogleNotConnectedException('Google rejected the access token.');
        }

        if (! $response->successful()) {
            $reason = $response->json('error.errors.0.reason') ?? $response->json('error.status') ?? $response->status();

            throw new ProviderException('Google Drive request failed: '.$reason, 'google_drive');
        }
    }
}
