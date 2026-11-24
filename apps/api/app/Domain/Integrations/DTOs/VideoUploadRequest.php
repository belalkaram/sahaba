<?php

namespace App\Domain\Integrations\DTOs;

class VideoUploadRequest
{
    public function __construct(
        public readonly string $title,
        public readonly ?string $filePath = null,
        public readonly ?string $externalId = null,
        public readonly array $metadata = [],
        public readonly string $mediaType = 'video',
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            title: $data['title'],
            filePath: $data['file_path'] ?? null,
            externalId: $data['external_id'] ?? null,
            metadata: $data['metadata'] ?? [],
            mediaType: $data['media_type'] ?? 'video',
        );
    }
}
