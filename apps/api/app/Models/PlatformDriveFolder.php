<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** The folder that holds one tenant's files inside one platform Drive account (ADR-009). */
class PlatformDriveFolder extends Model
{
    use HasUuids;

    protected $table = 'platform_drive_folders';

    protected $fillable = ['account_id', 'tenant_id', 'folder_id'];
}
