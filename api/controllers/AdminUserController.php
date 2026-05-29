<?php

function adminUsersIndex(): void
{
    requireAuth();
    $db        = getDB();
    $episodeId = isset($_GET['episode_id']) ? (int)$_GET['episode_id'] : null;

    if ($episodeId) {
        $stmt = $db->prepare("
            SELECT
                u.id, u.name, u.phone, u.district, u.created_at,
                s.total_correct        AS score,
                s.total_time_seconds   AS time_seconds,
                s.completed_at,
                s.published,
                RANK() OVER (ORDER BY s.total_correct DESC, s.total_time_seconds ASC) AS `rank`
            FROM users u
            JOIN quiz_sessions s ON s.user_id = u.id
                AND s.episode_id = ? AND s.status = 'completed'
            WHERE u.is_admin = 0
            ORDER BY s.total_correct DESC, s.total_time_seconds ASC
        ");
        $stmt->execute([$episodeId]);
        jsonResponse($stmt->fetchAll());
    } else {
        $rows = $db->query("
            SELECT
                u.id, u.name, u.phone, u.district, u.created_at,
                COUNT(DISTINCT s.id)      AS total_sessions,
                MAX(s.total_correct)      AS best_score,
                MIN(s.total_time_seconds) AS best_time
            FROM users u
            LEFT JOIN quiz_sessions s ON s.user_id = u.id AND s.status = 'completed'
            WHERE u.is_admin = 0
            GROUP BY u.id
            ORDER BY u.created_at DESC
        ")->fetchAll();
        jsonResponse($rows);
    }
}

function adminUserShow(int $id): void
{
    requireAuth();
    $db   = getDB();

    $stmt = $db->prepare("SELECT id, name, phone, district, created_at FROM users WHERE id = ? AND is_admin = 0");
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    if (!$user) errorResponse('User not found', 404);

    // Sessions with episode info
    $sessions = $db->prepare("
        SELECT s.*, e.name AS episode_name, e.episode_no
        FROM quiz_sessions s
        LEFT JOIN episodes e ON e.id = s.episode_id
        WHERE s.user_id = ?
        ORDER BY s.created_at DESC
    ");
    $sessions->execute([$id]);
    $user['sessions'] = $sessions->fetchAll();

    jsonResponse($user);
}
