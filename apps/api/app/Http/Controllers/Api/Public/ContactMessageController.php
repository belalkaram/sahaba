<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ContactMessageController extends Controller
{
    /**
     * POST /public/contact
     * Stores the message for platform staff; the page reports success only after this succeeds.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:190',
            'phone' => 'nullable|string|max:32',
            'institution' => 'nullable|string|max:190',
            'message' => 'required|string|min:10|max:5000',
        ]);

        $message = ContactMessage::create($validated);

        AuditLogger::log(
            action: 'contact_message.received',
            entityType: 'ContactMessage',
            entityId: (string) $message->id,
            actorType: 'public',
            actorEmail: $message->email
        );

        return ApiResponse::success(['id' => $message->id], Response::HTTP_CREATED);
    }
}
