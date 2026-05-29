<?php

function resultsIndex(): void
{
    requireAuth();
    $episodeId = isset($_GET['episode_id']) ? (int)$_GET['episode_id'] : null;
    $db        = getDB();

    $where = $episodeId ? "WHERE s.status = 'completed' AND s.episode_id = $episodeId"
                        : "WHERE s.status = 'completed'";

    $rows = $db->query("
        SELECT s.*, u.name, u.phone, u.district, e.name AS episode_name, e.episode_no
        FROM quiz_sessions s
        JOIN users u    ON u.id = s.user_id
        LEFT JOIN episodes e ON e.id = s.episode_id
        $where
        ORDER BY s.total_correct DESC, s.total_time_seconds ASC
    ")->fetchAll();

    $results = [];
    foreach ($rows as $i => $row) {
        $results[] = [
            'rank'               => $i + 1,
            'id'                 => (int)$row['id'],
            'user'               => [
                'id'       => (int)$row['user_id'],
                'name'     => $row['name'],
                'phone'    => $row['phone'],
                'district' => $row['district'],
            ],
            'episode'            => [
                'id'         => $row['episode_id'],
                'name'       => $row['episode_name'],
                'episode_no' => $row['episode_no'],
            ],
            'total_correct'      => (int)$row['total_correct'],
            'total_time_seconds' => (int)$row['total_time_seconds'],
            'completed_at'       => $row['completed_at'],
            'published'          => (bool)$row['published'],
        ];
    }
    jsonResponse($results);
}

function resultsStats(): void
{
    requireAuth();
    $episodeId = isset($_GET['episode_id']) ? (int)$_GET['episode_id'] : null;
    $db        = getDB();

    $epWhere = $episodeId ? "AND s.episode_id = $episodeId" : '';
    $qWhere  = $episodeId ? "AND q.episode_id = $episodeId" : '';

    $participants = (int)$db->query("SELECT COUNT(*) FROM quiz_sessions s WHERE s.status = 'completed' $epWhere")->fetchColumn();
    $questions    = (int)$db->query("SELECT COUNT(*) FROM questions q WHERE q.is_active = 1 $qWhere")->fetchColumn();
    $published    = (bool)$db->query("SELECT COUNT(*) FROM quiz_sessions s WHERE s.published = 1 $epWhere")->fetchColumn();

    jsonResponse([
        'total_participants' => $participants,
        'total_questions'    => $questions,
        'published'          => $published,
    ]);
}

function resultsPublish(): void
{
    requireAuth();
    $body      = getBody();
    $episodeId = isset($body['episode_id']) ? (int)$body['episode_id'] : null;
    $db        = getDB();

    if ($episodeId) {
        $db->prepare("UPDATE quiz_sessions SET published = 1 WHERE status = 'completed' AND episode_id = ?")
           ->execute([$episodeId]);
        $db->prepare("UPDATE episodes SET status = 'completed' WHERE id = ?")->execute([$episodeId]);
    } else {
        $db->query("UPDATE quiz_sessions SET published = 1 WHERE status = 'completed'");
    }
    jsonResponse(['message' => 'Results published successfully']);
}

function resultsUnpublish(): void
{
    requireAuth();
    $body      = getBody();
    $episodeId = isset($body['episode_id']) ? (int)$body['episode_id'] : null;
    $db        = getDB();

    if ($episodeId) {
        $db->prepare("UPDATE quiz_sessions SET published = 0 WHERE episode_id = ?")->execute([$episodeId]);
    } else {
        $db->query("UPDATE quiz_sessions SET published = 0");
    }
    jsonResponse(['message' => 'Results unpublished']);
}
