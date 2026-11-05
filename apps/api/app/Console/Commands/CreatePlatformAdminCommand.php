<?php

namespace App\Console\Commands;

use App\Models\PlatformRole;
use App\Models\PlatformUser;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class CreatePlatformAdminCommand extends Command
{
    protected $signature = 'platform:admin 
                            {email? : The email of the super admin} 
                            {password? : The password of the super admin} 
                            {--name= : The full name of the administrator}';

    protected $description = 'Create or update a Platform Super Administrator account';

    public function handle(): int
    {
        $email = $this->argument('email') ?: $this->ask('Enter admin email', 'admin@platform.local');
        $password = $this->argument('password') ?: $this->secret('Enter admin password (min 8 chars)');
        $name = $this->option('name') ?: 'Platform Super Administrator';

        if (! $password || strlen($password) < 8) {
            $this->error('Password must be at least 8 characters.');

            return self::FAILURE;
        }

        $superAdminRole = PlatformRole::firstOrCreate(
            ['name' => 'super_admin'],
            ['label' => 'مدير المنصة العام', 'description' => 'كامل صلاحيات إدارة المنصة والمؤسسات']
        );

        $user = PlatformUser::updateOrCreate(
            ['email' => strtolower(trim($email))],
            [
                'name' => $name,
                'password' => Hash::make($password),
                'status' => 'active',
            ]
        );

        if (! $user->roles()->where('role_id', $superAdminRole->id)->exists()) {
            $user->roles()->attach($superAdminRole->id);
        }

        $this->info("Platform Super Administrator [{$user->email}] configured successfully!");

        return self::SUCCESS;
    }
}

