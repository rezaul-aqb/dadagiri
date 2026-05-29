<?php

function getAuthHeader(): string
{
    // Apache may forward Authorization under different keys
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) {
            if (strtolower($k) === 'authorization') {
                return $v;
            }
        }
    }
    return '';
}

function requireAuth(): array
{
    $header = getAuthHeader();
    if (!preg_match('/Bearer\s+(.+)/i', $header, $m)) {
        errorResponse('Unauthenticated.', 401);
    }
    $token = trim($m[1]);

    $db   = getDB();
    $stmt = $db->prepare("
        SELECT u.* FROM users u
        JOIN personal_access_tokens t ON t.tokenable_id = u.id
        WHERE t.token = ? AND u.is_admin = 1
        LIMIT 1
    ");
    $stmt->execute([hash('sha256', $token)]);
    $user = $stmt->fetch();

    if (!$user) {
        errorResponse('Unauthenticated.', 401);
    }

    return $user;
}
