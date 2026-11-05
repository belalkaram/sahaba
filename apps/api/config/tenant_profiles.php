<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Tenant Archetypes & Profiles (OD-23, OD-24, ADR-002)
    |--------------------------------------------------------------------------
    */
    'types' => [
        'individual_teacher' => [
            'label' => 'معلم مستقل',
            'requires_organization_kind' => false,
            'roles' => ['owner', 'assistant', 'student', 'parent'],
            'labels' => [
                'branches' => 'أماكن التدريس والقاعات',
            ],
            'default_services' => ['online', 'offline'],
        ],
        'organization' => [
            'label' => 'مؤسسة تعليمية',
            'requires_organization_kind' => true,
            'allowed_kinds' => ['center', 'academy', 'school', 'institute'],
            'roles' => [
                'owner',
                'center_admin',
                'branch_manager',
                'teacher',
                'assistant',
                'finance',
                'student',
                'parent',
            ],
            'labels' => [
                'branches' => 'الفروع والقاعات',
            ],
            'default_services' => ['online', 'offline'],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Service Bundles (OD-31)
    |--------------------------------------------------------------------------
    */
    'services' => [
        'online' => [
            'label' => 'التعليم الأونلاين',
            'description' => 'المقررات، الفيديوهات، الحصص المباشرة، التقييمات والاختبارات الرقمية',
            'modules' => ['courses', 'assessments', 'meetings', 'media', 'online'],
        ],
        'offline' => [
            'label' => 'التعليم الحضوري (الأوفلاين)',
            'description' => 'الفصول، الحصص، رصد الحضور بالـQR، القاعات والمقرات، المساعدين',
            'modules' => ['attendance', 'classes', 'sessions', 'offline', 'credentials'],
        ],
        'core' => [
            'label' => 'النظام الأساسي',
            'modules' => ['core', 'billing', 'analytics'],
        ],
    ],
];
