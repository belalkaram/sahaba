<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
</head>
<body style="margin:0;padding:24px;background:#F8F8F6;font-family:Tahoma,Arial,sans-serif;color:#121A18;">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E3E3DD;border-radius:12px;" cellpadding="0" cellspacing="0">
        <tr>
            <td style="padding:16px 24px;border-radius:12px 12px 0 0;background:{{ preg_match('/^#[0-9a-fA-F]{3,8}$/', $brandColor) ? $brandColor : '#0C7F6D' }};color:#FFFFFF;font-weight:bold;">
                {{ $tenantName }}
            </td>
        </tr>
        <tr>
            <td style="padding:24px;">
                <p style="margin:0 0 8px;font-size:14px;color:#525B56;">مرحباً {{ $recipientName }}،</p>
                <h1 style="margin:0 0 12px;font-size:18px;">{{ $title }}</h1>
                <p style="margin:0;font-size:15px;line-height:1.8;">{{ $body }}</p>
            </td>
        </tr>
        <tr>
            <td style="padding:12px 24px;border-top:1px solid #F0F0EC;font-size:12px;color:#6E7670;">
                يمكنك التحكم في هذه الرسائل من إعدادات الإشعارات في حسابك.
            </td>
        </tr>
    </table>
</body>
</html>
