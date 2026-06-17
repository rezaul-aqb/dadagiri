<?php

function tossIndex(): void
{
    requireAuth();
    $episodeId = (int)($_GET['episode_id'] ?? 0);
    if (!$episodeId) errorResponse('episode_id required', 422);
    $db   = getDB();
    $stmt = $db->prepare("SELECT * FROM toss_questions WHERE episode_id = ? ORDER BY id");
    $stmt->execute([$episodeId]);
    jsonResponse($stmt->fetchAll());
}

function tossStore(): void
{
    requireAuth();
    $body = getBody();
    if (empty($body['episode_id'])) errorResponse('episode_id required', 422);
    if (!isset($body['answer']) || $body['answer'] === '') errorResponse('answer required', 422);

    $db = getDB();
    $db->prepare("
        INSERT INTO toss_questions
            (episode_id, round_id, question_text,
             hint_1, hint_2, hint_3, hint_4, hint_5, hint_6,
             answer, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ")->execute([
        (int)$body['episode_id'],
        !empty($body['round_id']) ? (int)$body['round_id'] : null,
        $body['question_text'] ?? '',
        $body['hint_1'] ?? null,
        $body['hint_2'] ?? null,
        $body['hint_3'] ?? null,
        $body['hint_4'] ?? null,
        $body['hint_5'] ?? null,
        $body['hint_6'] ?? null,
        strtoupper(trim($body['answer'])),
    ]);

    $id  = $db->lastInsertId();
    $row = $db->query("SELECT * FROM toss_questions WHERE id = $id")->fetch();
    jsonResponse($row, 201);
}

function tossUpdate(int $id): void
{
    requireAuth();
    $body = getBody();
    $db   = getDB();

    $stmt = $db->prepare("SELECT id FROM toss_questions WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) errorResponse('Not found', 404);

    $db->prepare("
        UPDATE toss_questions SET
            round_id=?, question_text=?,
            hint_1=?, hint_2=?, hint_3=?, hint_4=?, hint_5=?, hint_6=?,
            answer=?, updated_at=NOW()
        WHERE id=?
    ")->execute([
        !empty($body['round_id']) ? (int)$body['round_id'] : null,
        $body['question_text'] ?? '',
        $body['hint_1'] ?? null,
        $body['hint_2'] ?? null,
        $body['hint_3'] ?? null,
        $body['hint_4'] ?? null,
        $body['hint_5'] ?? null,
        $body['hint_6'] ?? null,
        strtoupper(trim($body['answer'] ?? '')),
        $id,
    ]);

    $row = $db->query("SELECT * FROM toss_questions WHERE id = $id")->fetch();
    jsonResponse($row);
}

function tossDestroy(int $id): void
{
    requireAuth();
    $db   = getDB();
    $stmt = $db->prepare("SELECT id FROM toss_questions WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) errorResponse('Not found', 404);
    $db->prepare("DELETE FROM toss_questions WHERE id = ?")->execute([$id]);
    jsonResponse(['message' => 'Deleted']);
}

function tossGoLive(int $id): void
{
    requireAuth();
    $db   = getDB();
    $stmt = $db->prepare("SELECT episode_id FROM toss_questions WHERE id = ?");
    $stmt->execute([$id]);
    $row  = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);

    $db->prepare("UPDATE toss_questions SET is_live = 0 WHERE episode_id = ?")
       ->execute([$row['episode_id']]);
    $db->prepare("UPDATE toss_questions SET is_live = 1, updated_at = NOW() WHERE id = ?")
       ->execute([$id]);

    $row = $db->query("SELECT * FROM toss_questions WHERE id = $id")->fetch();
    jsonResponse($row);
}

function tossStopLive(): void
{
    requireAuth();
    getDB()->query("UPDATE toss_questions SET is_live = 0");
    jsonResponse(['message' => 'Stopped']);
}

function tossToggleHint(int $id): void
{
    requireAuth();
    $body = getBody();
    $hint = (int)($body['hint'] ?? 0);
    if ($hint < 1 || $hint > 6) errorResponse('hint must be 1–6', 422);

    $db  = getDB();
    $col = "show_hint_$hint";
    $stmt = $db->prepare("SELECT $col FROM toss_questions WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) errorResponse('Not found', 404);

    $newVal = $row[$col] ? 0 : 1;
    $db->prepare("UPDATE toss_questions SET $col = ?, updated_at = NOW() WHERE id = ?")
       ->execute([$newVal, $id]);

    $row = $db->query("SELECT * FROM toss_questions WHERE id = $id")->fetch();
    jsonResponse($row);
}

function tossResetHints(int $id): void
{
    requireAuth();
    $db = getDB();
    $db->prepare("
        UPDATE toss_questions SET
            show_hint_1=0, show_hint_2=0, show_hint_3=0,
            show_hint_4=0, show_hint_5=0, show_hint_6=0,
            hints_revealed=0, updated_at=NOW()
        WHERE id=?
    ")->execute([$id]);
    $row = $db->query("SELECT * FROM toss_questions WHERE id = $id")->fetch();
    jsonResponse($row);
}

function tossEligibility(): void
{
    $episodeId = (int)($_GET['episode_id'] ?? 0);
    $userId    = (int)($_GET['user_id']    ?? 0);
    if (!$episodeId || !$userId) errorResponse('episode_id and user_id required', 422);

    $db = getDB();
    // User is eligible if they won at least one question in the selection round
    $stmt = $db->prepare("
        SELECT COUNT(*) AS cnt
        FROM answers a
        JOIN quiz_sessions s ON s.id = a.session_id
        WHERE s.episode_id = ? AND a.user_id = ? AND a.is_correct = 1
          AND COALESCE(a.time_taken_ms, a.time_taken_seconds * 1000) = (
              SELECT MIN(COALESCE(a2.time_taken_ms, a2.time_taken_seconds * 1000))
              FROM answers a2
              JOIN quiz_sessions s2 ON s2.id = a2.session_id
              WHERE s2.episode_id = ? AND a2.question_id = a.question_id AND a2.is_correct = 1
          )
    ");
    $stmt->execute([$episodeId, $userId, $episodeId]);
    $row = $stmt->fetch();
    jsonResponse(['eligible' => (int)$row['cnt'] > 0]);
}

function tossSubmitAnswer(): void
{
    $body          = getBody();
    $tossQId       = (int)($body['toss_question_id'] ?? 0);
    $userId        = (int)($body['user_id']          ?? 0);
    $episodeId     = (int)($body['episode_id']        ?? 0);
    $answer        = strtoupper(trim($body['answer']  ?? ''));

    if (!$tossQId || !$userId || !$episodeId) errorResponse('toss_question_id, user_id, episode_id required', 422);

    $db = getDB();

    // Prevent duplicate submission
    $stmt = $db->prepare("SELECT id FROM toss_answers WHERE toss_question_id = ? AND user_id = ?");
    $stmt->execute([$tossQId, $userId]);
    if ($stmt->fetch()) { jsonResponse(['saved' => false, 'duplicate' => true]); return; }

    // Get correct answer
    $stmt = $db->prepare("SELECT answer FROM toss_questions WHERE id = ?");
    $stmt->execute([$tossQId]);
    $tq = $stmt->fetch();
    if (!$tq) errorResponse('Toss question not found', 404);

    $isCorrect = ($answer !== '' && $answer === strtoupper(trim($tq['answer']))) ? 1 : 0;
    $now = date('Y-m-d H:i:s');

    $db->prepare("
        INSERT INTO toss_answers (toss_question_id, episode_id, user_id, answer, is_correct, answered_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ")->execute([$tossQId, $episodeId, $userId, $answer, $isCorrect, $now, $now, $now]);

    jsonResponse(['saved' => true, 'is_correct' => (bool)$isCorrect]);
}

function tossLive(): void
{
    $db  = getDB();
    $row = $db->query(
        "SELECT id, question_text,
                hint_1, hint_2, hint_3, hint_4, hint_5, hint_6,
                show_hint_1, show_hint_2, show_hint_3, show_hint_4, show_hint_5, show_hint_6,
                answer, hints_revealed
         FROM toss_questions WHERE is_live = 1 LIMIT 1"
    )->fetch();
    jsonResponse($row ?: null);
}
