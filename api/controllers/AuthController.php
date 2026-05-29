<?php

function adminLogin(): void
{
    $body = getBody();
    $errors = validate($body, [
        'email'    => 'required|email',
        'password' => 'required',
    ]);
    if ($errors) {
        jsonResponse(['errors' => $errors], 422);
    }

    $db   = getDB();
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND is_admin = 1 LIMIT 1");
    $stmt->execute([$body['email']]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($body['password'], $user['password'])) {
        jsonResponse(['errors' => ['email' => ['Invalid credentials or not an admin account.']]], 422);
    }

    // Delete old tokens
    $db->prepare("DELETE FROM personal_access_tokens WHERE tokenable_id = ?")->execute([$user['id']]);

    // Create new token
    $plainText = bin2hex(random_bytes(40));
    $hashed    = hash('sha256', $plainText);
    $db->prepare("
        INSERT INTO personal_access_tokens (tokenable_type, tokenable_id, name, token, created_at, updated_at)
        VALUES ('App\\\\Models\\\\User', ?, 'admin-token', ?, NOW(), NOW())
    ")->execute([$user['id'], $hashed]);

    unset($user['password'], $user['remember_token']);
    jsonResponse(['user' => $user, 'token' => $plainText]);
}

function adminLogout(): void
{
    $user = requireAuth();
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    preg_match('/Bearer\s+(.+)/i', $header, $m);
    $db = getDB();
    $db->prepare("DELETE FROM personal_access_tokens WHERE tokenable_id = ? AND token = ?")
       ->execute([$user['id'], hash('sha256', $m[1])]);
    jsonResponse(['message' => 'Logged out successfully']);
}

function adminMe(): void
{
    $user = requireAuth();
    unset($user['password'], $user['remember_token']);
    jsonResponse($user);
}
