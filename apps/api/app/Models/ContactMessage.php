<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Message submitted through the public contact form (R7F). Read by platform staff.
 */
class ContactMessage extends Model
{
    protected $fillable = ['name', 'email', 'phone', 'institution', 'message', 'status', 'handled_at'];

    protected $casts = ['handled_at' => 'datetime'];
}
