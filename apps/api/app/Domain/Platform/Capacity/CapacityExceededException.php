<?php

namespace App\Domain\Platform\Capacity;

use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

/** ADR-006: the academy has no free seat. Rendered as 409 CAPACITY_EXCEEDED with the numbers. */
class CapacityExceededException extends RuntimeException
{
    public function __construct(public readonly int $used, public readonly int $quota, public readonly int $needed = 1)
    {
        parent::__construct('CAPACITY_EXCEEDED');
    }

    public function render(): JsonResponse
    {
        return ApiResponse::error(
            'CAPACITY_EXCEEDED',
            sprintf('اكتمل عدد الطلاب/الأكواد المسموح لمؤسستك (%d من %d). اطلب زيادة السعة من إدارة المنصة.', $this->used, $this->quota),
            Response::HTTP_CONFLICT,
            ['used' => $this->used, 'quota' => $this->quota, 'needed' => $this->needed],
        );
    }
}
