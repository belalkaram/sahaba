<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Platform Admin Token (Interim — R0-1 / OD-10)
    |--------------------------------------------------------------------------
    |
    | A static bearer token used to authenticate requests to the Platform
    | Administration API endpoints (tenant CRUD, support access, audit logs).
    |
    | Set PLATFORM_ADMIN_TOKEN in .env to a long random string.
    | An empty value disables all platform routes (deny-by-default).
    |
    | This interim mechanism will be replaced by real platform_users accounts
    | with individual tokens in R1-A9.
    |
    */
    'admin_token' => env('PLATFORM_ADMIN_TOKEN', ''),
];
