<?php

function quizLiveQuestion(): void
{
    $db = getDB();
    $q  = $db->query(
        "SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.image,
                q.show_option_a, q.show_option_b, q.show_option_c, q.show_option_d,
                r.name AS round_name,
                COALESCE(r.requires_selection, 0) AS round_requires_selection
         FROM questions q
         LEFT JOIN rounds r ON r.id = q.round_id
         WHERE q.is_live = 1 LIMIT 1"
    )->fetch();
    jsonResponse($q ?: null);
}

function quizActiveEpisode(): void
{
    $db = getDB();
    $episode = $db->query(
        "SELECT id, name, episode_no, status, start_date, end_date
         FROM episodes WHERE status = 'active' ORDER BY episode_no DESC LIMIT 1"
    )->fetch();

    if (!$episode) {
        errorResponse('No active episode at the moment', 404);
        return;
    }

    $stmt = $db->prepare(
        "SELECT id, question_text, option_a, option_b, option_c, option_d,
                show_option_a, show_option_b, show_option_c, show_option_d, `order`
         FROM questions WHERE episode_id = ? AND is_active = 1 ORDER BY `order`, id"
    );
    $stmt->execute([(int)$episode['id']]);
    $episode['questions'] = $stmt->fetchAll();

    jsonResponse($episode);
}

function quizStart(): void
{
    $db   = getDB();
    $body = getBody();

    $userId    = (int)($body['user_id'] ?? 0);
    $episodeId = (int)($body['episode_id'] ?? 0);

    if (!$userId || !$episodeId) {
        errorResponse('user_id and episode_id are required', 422);
        return;
    }

    $stmt = $db->prepare("SELECT id FROM users WHERE id = ? AND is_admin = 0");
    $stmt->execute([$userId]);
    if (!$stmt->fetch()) {
        errorResponse('User not found', 404);
        return;
    }

    $stmt = $db->prepare("SELECT id FROM episodes WHERE id = ? AND status = 'active'");
    $stmt->execute([$episodeId]);
    if (!$stmt->fetch()) {
        errorResponse('Episode is not active', 422);
        return;
    }

    $stmt = $db->prepare(
        "SELECT id FROM quiz_sessions WHERE user_id = ? AND episode_id = ? AND status = 'completed'"
    );
    $stmt->execute([$userId, $episodeId]);
    if ($stmt->fetch()) {
        errorResponse('You have already completed this episode', 409);
        return;
    }

    $db->prepare(
        "UPDATE quiz_sessions SET status = 'abandoned', updated_at = NOW()
         WHERE user_id = ? AND episode_id = ? AND status = 'started'"
    )->execute([$userId, $episodeId]);

    $db->prepare(
        "INSERT INTO quiz_sessions (user_id, episode_id, status, started_at, created_at, updated_at)
         VALUES (?, ?, 'started', NOW(), NOW(), NOW())"
    )->execute([$userId, $episodeId]);

    jsonResponse(['session_id' => (int)$db->lastInsertId()]);
}

function quizSubmit(): void
{
    $db   = getDB();
    $body = getBody();

    $sessionId = (int)($body['session_id'] ?? 0);
    $userId    = (int)($body['user_id'] ?? 0);
    $answers   = $body['answers'] ?? [];

    if (!$sessionId || !$userId || !is_array($answers) || empty($answers)) {
        errorResponse('session_id, user_id, and answers are required', 422);
        return;
    }

    $stmt = $db->prepare(
        "SELECT * FROM quiz_sessions WHERE id = ? AND user_id = ? AND status = 'started'"
    );
    $stmt->execute([$sessionId, $userId]);
    $session = $stmt->fetch();
    if (!$session) {
        errorResponse('Session not found or already completed', 404);
        return;
    }

    $stmt = $db->prepare(
        "SELECT id, correct_answer FROM questions WHERE episode_id = ? AND is_active = 1"
    );
    $stmt->execute([(int)$session['episode_id']]);
    $correctMap = [];
    foreach ($stmt->fetchAll() as $q) {
        $correctMap[(int)$q['id']] = $q['correct_answer'];
    }

    $totalCorrect = 0;
    $totalTime    = 0;
    $now          = date('Y-m-d H:i:s');

    $insertStmt = $db->prepare(
        "INSERT INTO answers
         (session_id, user_id, question_id, chosen_answer, is_correct, time_taken_seconds, time_taken_ms, answered_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    foreach ($answers as $ans) {
        $qId       = (int)($ans['question_id'] ?? 0);
        $chosen    = isset($ans['chosen_answer']) && $ans['chosen_answer']
                     ? strtoupper(trim($ans['chosen_answer'])) : null;
        $timeTakenMs  = isset($ans['time_taken_ms']) ? max((int)$ans['time_taken_ms'], 0) : null;
        $timeTakenSec = $timeTakenMs !== null
                        ? min((int)floor($timeTakenMs / 1000), 60)
                        : min(max((int)($ans['time_taken_seconds'] ?? 0), 0), 60);

        if (!isset($correctMap[$qId])) continue;

        $isCorrect = ($chosen && $chosen === $correctMap[$qId]) ? 1 : 0;
        if ($isCorrect) $totalCorrect++;
        $totalTime += $timeTakenSec;

        $insertStmt->execute([
            $sessionId, $userId, $qId,
            $chosen, $isCorrect, $timeTakenSec, $timeTakenMs,
            $now, $now, $now,
        ]);
    }

    $db->prepare(
        "UPDATE quiz_sessions
         SET status = 'completed', completed_at = NOW(),
             total_correct = ?, total_time_seconds = ?, updated_at = NOW()
         WHERE id = ?"
    )->execute([$totalCorrect, $totalTime, $sessionId]);

    jsonResponse([
        'session_id'         => $sessionId,
        'total_correct'      => $totalCorrect,
        'total_questions'    => count($correctMap),
        'total_time_seconds' => $totalTime,
    ]);
}

function quizResult(): void
{
    $db        = getDB();
    $sessionId = (int)($_GET['session_id'] ?? 0);

    if (!$sessionId) {
        errorResponse('session_id is required', 422);
        return;
    }

    $stmt = $db->prepare("
        SELECT s.id, s.total_correct, s.total_time_seconds, s.completed_at, s.published,
               u.name, u.phone, u.district,
               e.name AS episode_name, e.episode_no,
               (SELECT COUNT(*) FROM questions q
                WHERE q.episode_id = s.episode_id AND q.is_active = 1) AS total_questions
        FROM quiz_sessions s
        JOIN users u ON u.id = s.user_id
        JOIN episodes e ON e.id = s.episode_id
        WHERE s.id = ? AND s.status = 'completed'
    ");
    $stmt->execute([$sessionId]);
    $result = $stmt->fetch();

    if (!$result) {
        errorResponse('Result not found', 404);
        return;
    }

    jsonResponse($result);
}

function quizSingleAnswer(): void
{
    $db   = getDB();
    $body = getBody();

    $sessionId  = (int)($body['session_id']  ?? 0);
    $userId     = (int)($body['user_id']     ?? 0);
    $questionId = (int)($body['question_id'] ?? 0);

    if (!$sessionId || !$userId || !$questionId) {
        errorResponse('session_id, user_id, question_id are required', 422);
        return;
    }

    // Verify session is active
    $stmt = $db->prepare(
        "SELECT id, episode_id FROM quiz_sessions
         WHERE id = ? AND user_id = ? AND status = 'started'"
    );
    $stmt->execute([$sessionId, $userId]);
    $session = $stmt->fetch();
    if (!$session) { errorResponse('Session not found or already completed', 404); return; }

    // Verify question belongs to episode
    $stmt = $db->prepare(
        "SELECT correct_answer FROM questions
         WHERE id = ? AND episode_id = ? AND is_active = 1"
    );
    $stmt->execute([$questionId, (int)$session['episode_id']]);
    $q = $stmt->fetch();
    if (!$q) { errorResponse('Question not found', 404); return; }

    // Skip if already answered
    $stmt = $db->prepare("SELECT id FROM answers WHERE session_id = ? AND question_id = ?");
    $stmt->execute([$sessionId, $questionId]);
    if ($stmt->fetch()) { jsonResponse(['saved' => false, 'duplicate' => true]); return; }

    $chosen      = isset($body['chosen_answer']) && $body['chosen_answer']
                   ? strtoupper(trim($body['chosen_answer'])) : null;
    $timeTakenMs = isset($body['time_taken_ms']) ? max((int)$body['time_taken_ms'], 0) : null;
    $timeTakenSec = $timeTakenMs !== null
                   ? min((int)floor($timeTakenMs / 1000), 60)
                   : min(max((int)($body['time_taken_seconds'] ?? 0), 0), 60);
    $isCorrect   = ($chosen && $chosen === $q['correct_answer']) ? 1 : 0;
    $now         = date('Y-m-d H:i:s');

    $db->prepare(
        "INSERT INTO answers
         (session_id, user_id, question_id, chosen_answer, is_correct,
          time_taken_seconds, time_taken_ms, answered_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([
        $sessionId, $userId, $questionId,
        $chosen, $isCorrect, $timeTakenSec, $timeTakenMs,
        $now, $now, $now,
    ]);

    jsonResponse(['saved' => true, 'is_correct' => (bool)$isCorrect]);
}

function quizComplete(): void
{
    $db   = getDB();
    $body = getBody();

    $sessionId = (int)($body['session_id'] ?? 0);
    $userId    = (int)($body['user_id']    ?? 0);

    if (!$sessionId || !$userId) {
        errorResponse('session_id and user_id are required', 422);
        return;
    }

    $stmt = $db->prepare(
        "SELECT id, episode_id FROM quiz_sessions
         WHERE id = ? AND user_id = ? AND status = 'started'"
    );
    $stmt->execute([$sessionId, $userId]);
    $session = $stmt->fetch();
    if (!$session) { errorResponse('Session not found or already completed', 404); return; }

    // Tally from stored answers
    $stmt = $db->prepare(
        "SELECT COUNT(*) AS total,
                SUM(is_correct) AS correct,
                SUM(time_taken_seconds) AS total_time
         FROM answers WHERE session_id = ?"
    );
    $stmt->execute([$sessionId]);
    $stats = $stmt->fetch();

    $db->prepare(
        "UPDATE quiz_sessions
         SET status = 'completed', completed_at = NOW(),
             total_correct = ?, total_time_seconds = ?, updated_at = NOW()
         WHERE id = ?"
    )->execute([
        (int)($stats['correct']    ?? 0),
        (int)($stats['total_time'] ?? 0),
        $sessionId,
    ]);

    jsonResponse([
        'session_id'      => $sessionId,
        'total_answers'   => (int)($stats['total']      ?? 0),
        'total_correct'   => (int)($stats['correct']    ?? 0),
        'total_time_seconds' => (int)($stats['total_time'] ?? 0),
    ]);
}
