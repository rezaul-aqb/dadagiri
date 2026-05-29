<?php

function episodesIndex(): void
{
    requireAuth();
    $db   = getDB();
    $rows = $db->query("
        SELECT e.*,
            (SELECT COUNT(*) FROM questions q WHERE q.episode_id = e.id) AS question_count,
            (SELECT COUNT(*) FROM quiz_sessions s WHERE s.episode_id = e.id AND s.status = 'completed') AS participant_count
        FROM episodes e
        ORDER BY e.episode_no DESC
    ")->fetchAll();
    jsonResponse($rows);
}

function episodesStore(): void
{
    requireAuth();
    $body   = getBody();
    $errors = validate($body, [
        'name'       => 'required',
        'episode_no' => 'required',
    ]);
    if ($errors) jsonResponse(['errors' => $errors], 422);

    $db = getDB();
    $db->prepare("
        INSERT INTO episodes (name, episode_no, status, start_date, end_date, time_per_question, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    ")->execute([
        $body['name'],
        (int)$body['episode_no'],
        $body['status'] ?? 'draft',
        $body['start_date'] ?: null,
        $body['end_date']   ?: null,
        max(5, min(120, (int)($body['time_per_question'] ?? 30))),
    ]);

    $id = $db->lastInsertId();
    $ep = $db->query("SELECT * FROM episodes WHERE id = $id")->fetch();
    jsonResponse($ep, 201);
}

function episodesShow(int $id): void
{
    requireAuth();
    $db   = getDB();
    $stmt = $db->prepare("SELECT * FROM episodes WHERE id = ?");
    $stmt->execute([$id]);
    $ep = $stmt->fetch();
    if (!$ep) errorResponse('Episode not found', 404);
    jsonResponse($ep);
}

function episodesUpdate(int $id): void
{
    requireAuth();
    $body   = getBody();
    $errors = validate($body, [
        'name'       => 'required',
        'episode_no' => 'required',
    ]);
    if ($errors) jsonResponse(['errors' => $errors], 422);

    $db   = getDB();
    $stmt = $db->prepare("SELECT id FROM episodes WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) errorResponse('Episode not found', 404);

    $db->prepare("
        UPDATE episodes SET name=?, episode_no=?, status=?, start_date=?, end_date=?, time_per_question=?, updated_at=NOW()
        WHERE id=?
    ")->execute([
        $body['name'],
        (int)$body['episode_no'],
        $body['status'] ?? 'draft',
        $body['start_date'] ?: null,
        $body['end_date']   ?: null,
        max(5, min(120, (int)($body['time_per_question'] ?? 30))),
        $id,
    ]);

    $ep = $db->query("SELECT * FROM episodes WHERE id = $id")->fetch();
    jsonResponse($ep);
}

function episodesDestroy(int $id): void
{
    requireAuth();
    $db   = getDB();
    $stmt = $db->prepare("SELECT id FROM episodes WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) errorResponse('Episode not found', 404);

    $db->prepare("DELETE FROM episodes WHERE id = ?")->execute([$id]);
    jsonResponse(['message' => 'Episode deleted']);
}

function episodeAnalysis(int $id): void
{
    requireAuth();
    $db = getDB();

    $ep = $db->prepare("SELECT id, name, episode_no FROM episodes WHERE id = ?");
    $ep->execute([$id]);
    $episode = $ep->fetch();
    if (!$episode) errorResponse('Episode not found', 404);

    // All questions for this episode
    $qStmt = $db->prepare(
        "SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer, `order`
         FROM questions WHERE episode_id = ? AND is_active = 1 ORDER BY `order`, id"
    );
    $qStmt->execute([$id]);
    $questions = $qStmt->fetchAll();

    // Total attempts per question
    $attStmt = $db->prepare(
        "SELECT a.question_id, COUNT(*) AS total_attempts
         FROM answers a
         JOIN quiz_sessions s ON s.id = a.session_id AND s.status = 'completed'
         WHERE a.question_id IN (SELECT id FROM questions WHERE episode_id = ?)
         GROUP BY a.question_id"
    );
    $attStmt->execute([$id]);
    $attempts = [];
    foreach ($attStmt->fetchAll() as $row) {
        $attempts[(int)$row['question_id']] = (int)$row['total_attempts'];
    }

    // Users who answered correctly, ordered by time taken
    $corrStmt = $db->prepare(
        "SELECT a.question_id, u.id AS user_id, u.name, u.phone, u.district,
                a.time_taken_seconds
         FROM answers a
         JOIN quiz_sessions s ON s.id = a.session_id AND s.status = 'completed'
         JOIN users u ON u.id = a.user_id
         WHERE a.is_correct = 1
           AND a.question_id IN (SELECT id FROM questions WHERE episode_id = ?)
         ORDER BY a.question_id, a.time_taken_seconds ASC"
    );
    $corrStmt->execute([$id]);
    $correctMap = [];
    foreach ($corrStmt->fetchAll() as $row) {
        $correctMap[(int)$row['question_id']][] = [
            'user_id'           => $row['user_id'],
            'name'              => $row['name'],
            'phone'             => $row['phone'],
            'district'          => $row['district'],
            'time_taken_seconds'=> (int)$row['time_taken_seconds'],
        ];
    }

    // Build response
    $result = [];
    foreach ($questions as $q) {
        $qId          = (int)$q['id'];
        $optionMap    = ['A' => $q['option_a'], 'B' => $q['option_b'], 'C' => $q['option_c'], 'D' => $q['option_d']];
        $result[] = [
            'id'             => $qId,
            'order'          => $q['order'],
            'question_text'  => $q['question_text'],
            'correct_answer' => $q['correct_answer'],
            'correct_text'   => $optionMap[$q['correct_answer']] ?? '',
            'option_a'       => $q['option_a'],
            'option_b'       => $q['option_b'],
            'option_c'       => $q['option_c'],
            'option_d'       => $q['option_d'],
            'total_attempts' => $attempts[$qId] ?? 0,
            'correct_count'  => count($correctMap[$qId] ?? []),
            'correct_users'  => $correctMap[$qId] ?? [],
        ];
    }

    jsonResponse(['episode' => $episode, 'questions' => $result]);
}
