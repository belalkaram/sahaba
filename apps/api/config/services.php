<?php

return [

    'meetings' => [
        'default' => env('MEETING_PROVIDER', 'manual'),
        // Students may join this many minutes before the start and after the end.
        'join_window_minutes' => (int) env('MEETING_JOIN_WINDOW_MINUTES', 15),
    ],

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect_uri' => env('GOOGLE_REDIRECT_URI', 'http://localhost:8000/api/v1/integrations/google/callback'),
        // ADR-008: one consent covers Drive uploads (R4-3) and Meet via Calendar events (R8-6).
        'scopes' => [
            'openid',
            'email',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/calendar.events',
        ],
        // Where the browser lands after the OAuth callback (the web app, not the API).
        'connect_return_url' => rtrim((string) env('WEB_APP_URL', 'http://localhost:3000'), '/').'/admin/integrations',
        'upload_max_bytes' => (int) env('GOOGLE_DRIVE_UPLOAD_MAX_BYTES', 5 * 1024 * 1024 * 1024),
        // ADR-009: platform storage pool. The super admin page the pool OAuth callback returns to, and the free
        // space every account must keep on top of the file being uploaded.
        'pool_return_url' => rtrim((string) env('WEB_APP_URL', 'http://localhost:3000'), '/').'/platform/storage',
        'pool_margin_bytes' => (int) env('GOOGLE_DRIVE_POOL_MARGIN_BYTES', 1024 * 1024 * 1024),
    ],

];
