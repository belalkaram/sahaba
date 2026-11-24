<?php

namespace App\Domain\Integrations\Media;

use RuntimeException;

/** Google has not received every byte of the resumable upload yet. */
class UploadIncompleteException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('The file has not finished uploading to Google Drive.');
    }
}
