<?php

function questionsIndex(): void
{
    requireAuth();
    $episodeId = isset($_GET['episode_id']) ? (int)$_GET['episode_id'] : null;
    $db        = getDB();

    $select = "SELECT q.*, r.name AS round_name FROM questions q LEFT JOIN rounds r ON r.id = q.round_id";

    if ($episodeId) {
        $stmt = $db->prepare("$select WHERE q.episode_id = ? ORDER BY q.`order`, q.id");
        $stmt->execute([$episodeId]);
        $rows = $stmt->fetchAll();
    } else {
        $rows = $db->query("$select ORDER BY q.episode_id, q.`order`, q.id")->fetchAll();
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
        'correct_answer' => 'required|in:A,B,C,D',
    ]);
    if ($errors) jsonResponse(['errors' => $errors], 422);

    $db   = getDB();
    $stmt = $db->prepare("
        INSERT INTO questions (episode_id, round_id, question_text, option_a, option_b, option_c, option_d,
            correct_answer, `order`, is_active,
            show_option_a, show_option_b, show_option_c, show_option_d,
            created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ");
    $stmt->execute([
        (int)$body['episode_id'],
        !empty($body['round_id']) ? (int)$body['round_id'] : null,
        $body['question_text'],
        $body['option_a'],
        $body['option_b'],
        $body['option_c'],
        $body['option_d'],
        $body['correct_answer'],
        (int)($body['order'] ?? 0),
        isset($body['is_active']) ? (int)(bool)$body['is_active'] : 1,
        isset($body['show_option_a']) ? (int)(bool)$body['show_option_a'] : 1,
        isset($body['show_option_b']) ? (int)(bool)$body['show_option_b'] : 1,
        isset($body['show_option_c']) ? (int)(bool)$body['show_option_c'] : 1,
        isset($body['show_option_d']) ? (int)(bool)$body['show_option_d'] : 1,
    ]);

    $id = $db->lastInsertId();
    $q  = $db->query("SELECT q.*, r.name AS round_name FROM questions q LEFT JOIN rounds r ON r.id = q.round_id WHERE q.id = $id")->fetch();
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
        'correct_answer' => 'required|in:A,B,C,D',
    ]);
    if ($errors) jsonResponse(['errors' => $errors], 422);

    $db   = getDB();
    $stmt = $db->prepare("SELECT id FROM questions WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) errorResponse('Question not found', 404);

    $db->prepare("
        UPDATE questions SET
            round_id=?, question_text=?, option_a=?, option_b=?, option_c=?, option_d=?,
            correct_answer=?, `order`=?, is_active=?,
            show_option_a=?, show_option_b=?, show_option_c=?, show_option_d=?,
            updated_at=NOW()
        WHERE id=?
    ")->execute([
        !empty($body['round_id']) ? (int)$body['round_id'] : null,
        $body['question_text'],
        $body['option_a'], $body['option_b'], $body['option_c'], $body['option_d'],
        $body['correct_answer'],
        (int)($body['order'] ?? 0),
        isset($body['is_active']) ? (int)(bool)$body['is_active'] : 1,
        isset($body['show_option_a']) ? (int)(bool)$body['show_option_a'] : 1,
        isset($body['show_option_b']) ? (int)(bool)$body['show_option_b'] : 1,
        isset($body['show_option_c']) ? (int)(bool)$body['show_option_c'] : 1,
        isset($body['show_option_d']) ? (int)(bool)$body['show_option_d'] : 1,
        $id,
    ]);

    $q = $db->query("SELECT q.*, r.name AS round_name FROM questions q LEFT JOIN rounds r ON r.id = q.round_id WHERE q.id = $id")->fetch();
    jsonResponse($q);
}

function questionsUploadImage(int $id): void
{
    requireAuth();

    $db   = getDB();
    $stmt = $db->prepare("SELECT id, image FROM questions WHERE id = ?");
    $stmt->execute([$id]);
    $q = $stmt->fetch();
    if (!$q) errorResponse('Question not found', 404);

    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        errorResponse('No image uploaded or upload error', 422);
    }

    $file    = $_FILES['image'];
    $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!in_array($ext, $allowed)) {
        errorResponse('Only jpg, jpeg, png, gif, webp allowed', 422);
    }
    if ($file['size'] > 5 * 1024 * 1024) {
        errorResponse('Image must be under 5MB', 422);
    }

    // Delete old image if exists
    $uploadDir = __DIR__ . '/../../uploads/questions/';
    if ($q['image'] && file_exists($uploadDir . $q['image'])) {
        unlink($uploadDir . $q['image']);
    }

    $filename = 'q' . $id . '_' . time() . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
        errorResponse('Failed to save image', 500);
    }

    $db->prepare("UPDATE questions SET image = ?, updated_at = NOW() WHERE id = ?")
       ->execute([$filename, $id]);

    jsonResponse(['image' => $filename, 'url' => '/dadagiri/uploads/questions/' . $filename]);
}

function questionsDeleteImage(int $id): void
{
    requireAuth();

    $db   = getDB();
    $stmt = $db->prepare("SELECT id, image FROM questions WHERE id = ?");
    $stmt->execute([$id]);
    $q = $stmt->fetch();
    if (!$q) errorResponse('Question not found', 404);

    if ($q['image']) {
        $path = __DIR__ . '/../../uploads/questions/' . $q['image'];
        if (file_exists($path)) unlink($path);
        $db->prepare("UPDATE questions SET image = NULL, updated_at = NOW() WHERE id = ?")
           ->execute([$id]);
    }

    jsonResponse(['message' => 'Image removed']);
}

function questionsUploadAnswerImage(int $id): void
{
    requireAuth();

    $db   = getDB();
    $stmt = $db->prepare("SELECT id, answer_image FROM questions WHERE id = ?");
    $stmt->execute([$id]);
    $q = $stmt->fetch();
    if (!$q) errorResponse('Question not found', 404);

    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        errorResponse('No image uploaded or upload error', 422);
    }

    $file    = $_FILES['image'];
    $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!in_array($ext, $allowed)) {
        errorResponse('Only jpg, jpeg, png, gif, webp allowed', 422);
    }
    if ($file['size'] > 5 * 1024 * 1024) {
        errorResponse('Image must be under 5MB', 422);
    }

    $uploadDir = __DIR__ . '/../../uploads/questions/';
    if ($q['answer_image'] && file_exists($uploadDir . $q['answer_image'])) {
        unlink($uploadDir . $q['answer_image']);
    }

    $filename = 'qa' . $id . '_' . time() . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
        errorResponse('Failed to save image', 500);
    }

    $db->prepare("UPDATE questions SET answer_image = ?, updated_at = NOW() WHERE id = ?")
       ->execute([$filename, $id]);

    jsonResponse(['answer_image' => $filename, 'url' => '/dadagiri/uploads/questions/' . $filename]);
}

function questionsDeleteAnswerImage(int $id): void
{
    requireAuth();

    $db   = getDB();
    $stmt = $db->prepare("SELECT id, answer_image FROM questions WHERE id = ?");
    $stmt->execute([$id]);
    $q = $stmt->fetch();
    if (!$q) errorResponse('Question not found', 404);

    if ($q['answer_image']) {
        $path = __DIR__ . '/../../uploads/questions/' . $q['answer_image'];
        if (file_exists($path)) unlink($path);
        $db->prepare("UPDATE questions SET answer_image = NULL, updated_at = NOW() WHERE id = ?")
           ->execute([$id]);
    }

    jsonResponse(['message' => 'Answer image removed']);
}

function questionResults(int $id): void
{
    requireAuth();
    $db = getDB();

    // Verify question exists and get correct answer
    $stmt = $db->prepare("SELECT id, question_text, correct_answer FROM questions WHERE id = ?");
    $stmt->execute([$id]);
    $q = $stmt->fetch();
    if (!$q) errorResponse('Question not found', 404);

    // All users who answered this question
    $stmt = $db->prepare("
        SELECT
            u.id         AS user_id,
            u.name,
            u.district,
            a.chosen_answer,
            a.is_correct,
            a.time_taken_seconds,
            a.time_taken_ms,
            a.answered_at
        FROM answers a
        JOIN users u ON u.id = a.user_id
        WHERE a.question_id = ?
        ORDER BY a.is_correct DESC,
                 COALESCE(a.time_taken_ms, a.time_taken_seconds * 1000) ASC,
                 a.answered_at ASC
    ");
    $stmt->execute([$id]);
    $results = $stmt->fetchAll();

    jsonResponse([
        'question'       => $q,
        'results'        => $results,
        'total'          => count($results),
        'correct_count'  => count(array_filter($results, fn($r) => $r['is_correct'])),
    ]);
}

function questionsGoLive(int $id): void
{
    requireAuth();
    $db   = getDB();
    $stmt = $db->prepare("SELECT id, episode_id FROM questions WHERE id = ?");
    $stmt->execute([$id]);
    $q = $stmt->fetch();
    if (!$q) errorResponse('Question not found', 404);

    $db->prepare("UPDATE questions SET is_live = 0 WHERE episode_id = ?")
       ->execute([$q['episode_id']]);
    $db->prepare("UPDATE questions SET is_live = 1, live_started_at = NOW(), live_stopped_at = NULL, updated_at = NOW() WHERE id = ?")
       ->execute([$id]);

    $updated = $db->query("SELECT * FROM questions WHERE id = $id")->fetch();
    jsonResponse($updated);
}

function questionsStopLive(): void
{
    requireAuth();
    $db = getDB();
    // Capture stop time for any currently live question
    $db->query("UPDATE questions SET is_live = 0, live_stopped_at = NOW(), updated_at = NOW() WHERE is_live = 1");
    // Clear is_live for all (safety)
    $db->query("UPDATE questions SET is_live = 0 WHERE is_live = 1");
    jsonResponse(['message' => 'Stopped', 'stopped_at' => date('Y-m-d H:i:s')]);
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

function questionsToggleOption(int $id): void
{
    requireAuth();
    $body   = getBody();
    $option = $body['option'] ?? '';
    if (!in_array($option, ['a', 'b', 'c', 'd'])) errorResponse('Invalid option', 422);

    $db   = getDB();
    $col  = "show_option_$option";
    $stmt = $db->prepare("SELECT $col FROM questions WHERE id = ?");
    $stmt->execute([$id]);
    $row  = $stmt->fetch();
    if (!$row) errorResponse('Question not found', 404);

    $newVal = $row[$col] ? 0 : 1;
    $db->prepare("UPDATE questions SET $col = ?, updated_at = NOW() WHERE id = ?")
       ->execute([$newVal, $id]);

    jsonResponse(['option' => $option, 'show' => (bool)$newVal]);
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
