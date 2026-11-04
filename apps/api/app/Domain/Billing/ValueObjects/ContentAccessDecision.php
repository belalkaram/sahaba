<?php

namespace App\Domain\Billing\ValueObjects;

class ContentAccessDecision
{
    public function __construct(
        public readonly bool $allowed,
        public readonly string $reason = 'ok',
        public readonly array $requiredPackageIds = []
    ) {}

    public static function allow(): self
    {
        return new self(allowed: true, reason: 'ok', requiredPackageIds: []);
    }

    public static function deny(string $reason, array $requiredPackageIds = []): self
    {
        return new self(allowed: false, reason: $reason, requiredPackageIds: $requiredPackageIds);
    }

    public function isAllowed(): bool
    {
        return $this->allowed;
    }

    public function toArray(): array
    {
        return [
            'allowed' => $this->allowed,
            'reason' => $this->reason,
            'required_package_ids' => $this->requiredPackageIds,
        ];
    }
}
