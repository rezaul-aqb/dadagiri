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
                RANK() OVER (
                    ORDER BY s.total_correct DESC,
                    COALESCE(s.total_time_seconds, 999999) ASC
                ) AS `rank`
            FROM users u
            JOIN (
                SELECT user_id, MAX(id) AS session_id
                FROM quiz_sessions
                WHERE episode_id = ?
                GROUP BY user_id
            ) latest ON latest.user_id = u.id
            JOIN quiz_sessions s ON s.id = latest.session_id
            WHERE u.is_admin = 0
            ORDER BY score DESC, COALESCE(s.total_time_seconds, 999999) ASC
        ");
        $stmt->execute([$episodeId]);
        jsonResponse($stmt->fetchAll());
    } else {
        $rows = $db->query("
            SELECT
                u.id, u.name, u.phone, u.district, u.created_at,
                COALESCE(SUM(rs.score), 0) AS total_score
            FROM users u
            LEFT JOIN round_scores rs ON rs.user_id = u.id
            WHERE u.is_admin = 0
            GROUP BY u.id
            ORDER BY total_score DESC, u.created_at DESC
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
