<?php

function roundsIndex(): void
{
    requireAuth();
    $rows = getDB()->query("SELECT * FROM rounds ORDER BY id")->fetchAll();
    jsonResponse($rows);
}

function roundsUpdate(int $id): void
{
    requireAuth();
    $body = getBody();
    $name = trim($body['name'] ?? '');

    if (empty($name)) { errorResponse('name is required', 422); return; }

    $db   = getDB();
    $stmt = $db->prepare("SELECT id FROM rounds WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) { errorResponse('Round not found', 404); return; }

    $db->prepare("UPDATE rounds SET name = ?, updated_at = NOW() WHERE id = ?")
       ->execute([$name, $id]);

    $row = $db->query("SELECT * FROM rounds WHERE id = $id")->fetch();
    jsonResponse($row);
}

function roundsUpdateStatus(int $id): void
{
    requireAuth();
    $body   = getBody();
    $status = $body['status'] ?? null;
    if (!in_array($status, ['active', 'inactive'])) {
        errorResponse('status must be active or inactive', 422);
    }

    $db   = getDB();
    $stmt = $db->prepare("SELECT id FROM rounds WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) errorResponse('Round not found', 404);

    $db->prepare("UPDATE rounds SET status = ?, updated_at = NOW() WHERE id = ?")
       ->execute([$status, $id]);

    $row = $db->query("SELECT * FROM rounds WHERE id = $id")->fetch();
    jsonResponse($row);
}
