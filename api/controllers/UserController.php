<?php

function userRegister(): void
{
    $body   = getBody();
    $errors = validate($body, [
        'name'     => 'required',
        'phone'    => 'required',
        'district' => 'required',
    ]);

    if ($errors) {
        jsonResponse(['errors' => $errors], 422);
    }

    $name     = trim($body['name']);
    $phone    = trim($body['phone']);
    $district = trim($body['district']);

    // Validate phone: digits only, 10-15 chars
    if (!preg_match('/^[0-9]{10,15}$/', $phone)) {
        jsonResponse(['errors' => ['phone' => ['Please enter a valid phone number (10-15 digits).']]], 422);
    }

    $db = getDB();

    // Check duplicate phone
    $stmt = $db->prepare("SELECT id FROM users WHERE phone = ? LIMIT 1");
    $stmt->execute([$phone]);
    if ($stmt->fetch()) {
        jsonResponse(['errors' => ['phone' => ['This phone number is already registered.']]], 422);
    }

    // Create user (no password needed for quiz participants)
    $db->prepare("
        INSERT INTO users (name, phone, district, is_admin, password, created_at, updated_at)
        VALUES (?, ?, ?, 0, '', NOW(), NOW())
    ")->execute([$name, $phone, $district]);

    $userId = (int)$db->lastInsertId();
    $user   = $db->query("SELECT id, name, phone, district FROM users WHERE id = $userId")->fetch();

    jsonResponse(['user' => $user, 'message' => 'Registration successful'], 201);
}

function userLookup(): void
{
    $phone = trim($_GET['phone'] ?? '');

    if (empty($phone)) {
        errorResponse('phone is required', 422);
        return;
    }

    $db   = getDB();
    $stmt = $db->prepare(
        "SELECT id, name, phone, district FROM users WHERE phone = ? AND is_admin = 0 LIMIT 1"
    );
    $stmt->execute([$phone]);
    $user = $stmt->fetch();

    if (!$user) {
        errorResponse('User not found', 404);
        return;
    }

    jsonResponse(['user' => $user]);
}

function userUpdate(): void
{
    $body     = json_decode(file_get_contents('php://input'), true) ?? [];
    $id       = (int)($body['id'] ?? 0);
    $name     = trim($body['name'] ?? '');
    $district = trim($body['district'] ?? '');

    if (!$id)           { errorResponse('id is required', 422); return; }
    if (empty($name))   { errorResponse('name is required', 422); return; }
    if (empty($district)) { errorResponse('district is required', 422); return; }

    $db   = getDB();
    $stmt = $db->prepare("UPDATE users SET name = ?, district = ? WHERE id = ? AND is_admin = 0");
    $stmt->execute([$name, $district, $id]);

    $user = $db->prepare("SELECT id, name, phone, district FROM users WHERE id = ? LIMIT 1");
    $user->execute([$id]);
    jsonResponse(['user' => $user->fetch()]);
}
