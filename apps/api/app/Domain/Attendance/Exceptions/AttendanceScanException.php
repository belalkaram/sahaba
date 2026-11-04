<?php

namespace App\Domain\Attendance\Exceptions;

use Exception;

class AttendanceScanException extends Exception
{
    public function __construct(
        protected string $errorCode,
        string $message,
        protected array $extra = [],
        int $code = 422,
        ?Exception $previous = null
    ) {
        parent::__construct($message, $code, $previous);
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function getExtra(): array
    {
        return $this->extra;
    }
}
