<?php

function questionsIndex(): void
{
    requireAuth();
    $episodeId = isset($_GET['episode_id']) ? (int)$_GET['episode_id'] : null;
    $db        = getDB();

    if ($episodeId) {
        $stmt = $db->prepare("SELECT * FROM questions WHERE episode_id = ? ORDER BY `order`, id");
        $stmt->execute([$episodeId]);
        $rows = $stmt->fetchAll();
    } else {
        $rows = $db->query("SELECT * FROM questions ORDER BY episode_id, `order`, id")->fetchAll();
    }
    jsonResponse($rows);
}

function questionsStore(): void
{
    requireAuth();
    $body   = getBody();
    $errors = validate($body, [
        'episode_id'     => 'required',
        'question_text'  => 'required',
        'option_a'       => 'required',
        'option_b'       => 'required',
        'option_c'       => 'required',
        'option_d'       => 'required',
        'correct_answer' => 'required|in:A,B,C,D',
    ]);
    if ($errors) jsonResponse(['errors' => $errors], 422);

    $db   = getDB();
    $stmt = $db->prepare("
        INSERT INTO questions (episode_id, question_text, option_a, option_b, option_c, option_d, correct_answer, `order`, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ");
    $stmt->execute([
        (int)$body['episode_id'],
        $body['question_text'],
        $body['option_a'],
        $body['option_b'],
        $body['option_c'],
        $body['option_d'],
        $body['correct_answer'],
        (int)($body['order'] ?? 0),
        isset($body['is_active']) ? (int)(bool)$body['is_active'] : 1,
    ]);

    $id = $db->lastInsertId();
    $q  = $db->query("SELECT * FROM questions WHERE id = $id")->fetch();
    jsonResponse($q, 201);
}

function questionsShow(int $id): void
{
    requireAuth();
    $db   = getDB();
    $stmt = $db->prepare("SELECT * FROM questions WHERE id = ?");
    $stmt->execute([$id]);
    $q = $stmt->fetch();
    if (!$q) errorResponse('Question not found', 404);
    jsonResponse($q);
}

function questionsUpdate(int $id): void
{
    requireAuth();
    $body   = getBody();
    $errors = validate($body, [
        'question_text'  => 'required',
        'option_a'       => 'required',
        'option_b'       => 'required',
        'option_c'       => 'required',
        'option_d'       => 'required',
        'correct_answer' => 'required|in:A,B,C,D',
    ]);
    if ($errors) jsonResponse(['errors' => $errors], 422);

    $db   = getDB();
    $stmt = $db->prepare("SELECT id FROM questions WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) errorResponse('Question not found', 404);

    $db->prepare("
        UPDATE questions SET
            question_text=?, option_a=?, option_b=?, option_c=?, option_d=?,
            correct_answer=?, `order`=?, is_active=?, updated_at=NOW()
        WHERE id=?
    ")->execute([
        $body['question_text'],
        $body['option_a'], $body['option_b'], $body['option_c'], $body['option_d'],
        $body['correct_answer'],
        (int)($body['order'] ?? 0),
        isset($body['is_active']) ? (int)(bool)$body['is_active'] : 1,
        $id,
    ]);

    $q = $db->query("SELECT * FROM questions WHERE id = $id")->fetch();
    jsonResponse($q);
}

function questionsReorder(): void
{
    requireAuth();
    $body = getBody();
    if (empty($body['order']) || !is_array($body['order'])) {
        errorResponse('order array is required', 422);
    }

    $db   = getDB();
    $stmt = $db->prepare("UPDATE questions SET `order` = ?, updated_at = NOW() WHERE id = ?");
    foreach ($body['order'] as $i => $id) {
        $stmt->execute([$i + 1, (int)$id]);
    }
    jsonResponse(['message' => 'Order updated']);
}

function questionsDestroy(int $id): void
{
    requireAuth();
    $db   = getDB();
    $stmt = $db->prepare("SELECT id FROM questions WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) errorResponse('Question not found', 404);

    $db->prepare("DELETE FROM questions WHERE id = ?")->execute([$id]);
    jsonResponse(['message' => 'Question deleted']);
}
