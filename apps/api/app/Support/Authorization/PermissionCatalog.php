<?php

namespace App\Support\Authorization;

use InvalidArgumentException;

/**
 * PermissionCatalog (R1-A2)
 *
 * Single source of truth for all permissions, modules, and system role mappings.
 * Reads directly from `config/authorization.php`.
 */
class PermissionCatalog
{
    public const VALID_SCOPES = [
        'self',
        'linked',
        'own',
        'assigned',
        'branch',
        'tenant',
    ];

    /**
     * Get all registered permissions.
     *
     * @return array<string, array{module: string, label: string, scopes: array<string>}>
     */
    public static function permissions(): array
    {
        return config('authorization.permissions', []);
    }

    /**
     * Check if a permission exists in the catalog.
     */
    public static function has(string $permission): bool
    {
        return array_key_exists($permission, self::permissions());
    }

    /**
     * Get metadata for a specific permission.
     *
     * @return array{module: string, label: string, scopes: array<string>}|null
     */
    public static function get(string $permission): ?array
    {
        return self::permissions()[$permission] ?? null;
    }

    /**
     * Get the module a permission belongs to.
     */
    public static function getModule(string $permission): ?string
    {
        return self::get($permission)['module'] ?? null;
    }

    /**
     * Get allowed scopes for a specific permission.
     *
     * @return array<string>
     */
    public static function getScopes(string $permission): array
    {
        return self::get($permission)['scopes'] ?? [];
    }

    /**
     * Check if a given scope is valid for the specified permission.
     */
    public static function isScopeAllowed(string $permission, string $scope): bool
    {
        if (! in_array($scope, self::VALID_SCOPES, true)) {
            return false;
        }

        $allowed = self::getScopes($permission);

        return in_array($scope, $allowed, true);
    }

    /**
     * Get permissions grouped by module.
     *
     * @return array<string, array<string, array{label: string, scopes: array<string>}>>
     */
    public static function groupedByModule(): array
    {
        $grouped = [];
        foreach (self::permissions() as $name => $data) {
            $module = $data['module'] ?? 'core';
            $grouped[$module][$name] = [
                'label' => $data['label'] ?? $name,
                'scopes' => $data['scopes'] ?? ['tenant'],
            ];
        }

        return $grouped;
    }

    /**
     * Get all permissions for a specific module.
     *
     * @return array<string, array{module: string, label: string, scopes: array<string>}>
     */
    public static function forModule(string $module): array
    {
        return array_filter(
            self::permissions(),
            fn (array $item) => ($item['module'] ?? null) === $module
        );
    }

    /**
     * Get all registered modules.
     *
     * @return array<string, array{name: string, label: string, description: string, is_default: bool}>
     */
    public static function modules(): array
    {
        return config('authorization.modules', []);
    }

    /**
     * Check if a module key exists.
     */
    public static function hasModule(string $module): bool
    {
        return array_key_exists($module, self::modules());
    }

    /**
     * Get all standard system roles.
     *
     * @return array<string, array{label: string, description: string, is_system: bool, permissions: array<string, string>}>
     */
    public static function roles(): array
    {
        return config('authorization.roles', []);
    }

    /**
     * Get a specific system role definition.
     */
    public static function getRole(string $roleName): ?array
    {
        return self::roles()[$roleName] ?? null;
    }

    /**
     * Validate that a permission name exists, throwing an exception if invalid.
     *
     * @throws InvalidArgumentException
     */
    public static function validatePermission(string $permission, ?string $scope = null): void
    {
        if (! self::has($permission)) {
            throw new InvalidArgumentException("Permission [{$permission}] does not exist in authorization catalog.");
        }

        if ($scope !== null && ! self::isScopeAllowed($permission, $scope)) {
            $allowed = implode(', ', self::getScopes($permission));
            throw new InvalidArgumentException("Scope [{$scope}] is not allowed for permission [{$permission}]. Allowed: [{$allowed}].");
        }
    }
}
