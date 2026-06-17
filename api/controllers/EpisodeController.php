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
                a.time_taken_seconds, a.time_taken_ms
         FROM answers a
         JOIN quiz_sessions s ON s.id = a.session_id AND s.status = 'completed'
         JOIN users u ON u.id = a.user_id
         WHERE a.is_correct = 1
           AND a.question_id IN (SELECT id FROM questions WHERE episode_id = ?)
         ORDER BY a.question_id,
                  COALESCE(a.time_taken_ms, a.time_taken_seconds * 1000) ASC"
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
            'time_taken_ms'     => $row['time_taken_ms'] !== null ? (int)$row['time_taken_ms'] : null,
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

function episodeParticipants(int $id): void
{
    requireAuth();
    $db = getDB();

    $stmt = $db->prepare("SELECT id, name, episode_no FROM episodes WHERE id = ?");
    $stmt->execute([$id]);
    $episode = $stmt->fetch();
    if (!$episode) errorResponse('Episode not found', 404);

    // Questions for this episode (with round info)
    $stmt = $db->prepare(
        "SELECT q.id, q.`order`, q.question_text, q.correct_answer,
                q.round_id, r.name AS round_name
         FROM questions q
         LEFT JOIN rounds r ON r.id = q.round_id
         WHERE q.episode_id = ? AND q.is_active = 1
         ORDER BY q.`order`, q.id"
    );
    $stmt->execute([$id]);
    $questions = $stmt->fetchAll();

    // Build unique rounds list from questions
    $roundsMap = [];
    foreach ($questions as $q) {
        if ($q['round_id'] && !isset($roundsMap[(int)$q['round_id']])) {
            $roundsMap[(int)$q['round_id']] = $q['round_name'];
        }
    }

    // All answers for this episode grouped by user_id -> question_id
    $stmt = $db->prepare("
        SELECT a.user_id, a.question_id, a.chosen_answer, a.is_correct,
               a.time_taken_seconds, a.time_taken_ms
        FROM answers a
        JOIN quiz_sessions s ON s.id = a.session_id
        WHERE s.episode_id = ?
    ");
    $stmt->execute([$id]);
    $answerMap = [];
    foreach ($stmt->fetchAll() as $row) {
        $answerMap[(int)$row['user_id']][(int)$row['question_id']] = [
            'chosen_answer'      => $row['chosen_answer'],
            'is_correct'         => (bool)$row['is_correct'],
            'time_taken_seconds' => (int)$row['time_taken_seconds'],
            'time_taken_ms'      => $row['time_taken_ms'] !== null ? (int)$row['time_taken_ms'] : null,
        ];
    }

    // Per-question winner: for each question, the user who answered correctly with minimum time
    // Ordered by time ASC so first row per question_id is the fastest correct answer
    $stmt = $db->prepare("
        SELECT a.question_id, a.user_id,
               COALESCE(a.time_taken_ms, a.time_taken_seconds * 1000) AS time_ms
        FROM answers a
        JOIN quiz_sessions s ON s.id = a.session_id
        WHERE s.episode_id = ? AND a.is_correct = 1
        ORDER BY a.question_id ASC,
                 COALESCE(a.time_taken_ms, a.time_taken_seconds * 1000) ASC
    ");
    $stmt->execute([$id]);
    $questionWinners = []; // question_id => { user_id, time_ms }
    foreach ($stmt->fetchAll() as $row) {
        $qid = (int)$row['question_id'];
        if (!isset($questionWinners[$qid])) {   // keep only fastest (first row)
            $questionWinners[$qid] = [
                'user_id' => (int)$row['user_id'],
                'time_ms' => (int)$row['time_ms'],
            ];
        }
    }

    // Participants — one row per user (best session: completed > others, then score DESC, time ASC)
    $stmt = $db->prepare("
        SELECT
            s.id AS session_id,
            u.id AS user_id,
            u.name,
            u.phone,
            u.district,
            s.total_correct,
            s.total_time_seconds,
            s.completed_at,
            s.created_at AS joined_at,
            s.status
        FROM quiz_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.episode_id = ?
        ORDER BY (s.status = 'completed') DESC,
                 s.total_correct DESC,
                 s.total_time_seconds ASC,
                 s.completed_at ASC
    ");
    $stmt->execute([$id]);
    // Deduplicate: keep only the best session per user_id
    $seen = [];
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $uid = (int)$r['user_id'];
        if (!isset($seen[$uid])) {
            $seen[$uid] = true;
            $rows[] = $r;
        }
    }

    // is_selected = user won at least one question (across whole episode, overridden per-round on frontend)
    $allWinnerIds = [];
    foreach ($questionWinners as $w) { $allWinnerIds[$w['user_id']] = true; }
    foreach ($rows as &$r) {
        $r['is_selected'] = isset($allWinnerIds[(int)$r['user_id']]);
    }
    unset($r);

    $selectedCount = count(array_filter($rows, fn($r) => $r['is_selected']));

    // Build rounds array [{id, name}] in order
    $rounds = [];
    foreach ($roundsMap as $rId => $rName) {
        $rounds[] = ['id' => $rId, 'name' => $rName];
    }

    jsonResponse([
        'episode'          => $episode,
        'total_questions'  => count($questions),
        'questions'        => $questions,
        'rounds'           => $rounds,
        'answer_map'       => $answerMap,
        'question_winners' => $questionWinners,
        'participants'     => $rows,
        'total'            => count($rows),
        'selected_count'   => $selectedCount,
    ]);
}

function episodeRoundScores(int $id): void
{
    requireAuth();
    $db = getDB();

    $stmt = $db->prepare("SELECT * FROM episodes WHERE id = ?");
    $stmt->execute([$id]);
    $episode = $stmt->fetch();
    if (!$episode) errorResponse('Episode not found', 404);

    // ── MCQ rounds (questions in `questions` table) ─────────────────
    $stmt = $db->prepare("
        SELECT DISTINCT r.id, r.name, r.requires_selection
        FROM rounds r
        JOIN questions q ON q.round_id = r.id AND q.episode_id = ?
        WHERE q.is_active = 1
        ORDER BY r.id
    ");
    $stmt->execute([$id]);
    $mcqRounds = $stmt->fetchAll();

    $roundsOut = [];

    foreach ($mcqRounds as $round) {
        // Questions in this round
        $stmt = $db->prepare("
            SELECT id, question_text, correct_answer
            FROM questions WHERE round_id = ? AND episode_id = ? AND is_active = 1 ORDER BY id
        ");
        $stmt->execute([$round['id'], $id]);
        $qs = $stmt->fetchAll();
        $qIds = array_column($qs, 'id');

        if (empty($qIds)) {
            $roundsOut[] = ['id' => (int)$round['id'], 'name' => $round['name'],
                'type' => 'mcq', 'requires_selection' => (bool)$round['requires_selection'],
                'questions' => [], 'participants' => []];
            continue;
        }

        $ph = implode(',', array_fill(0, count($qIds), '?'));

        // All answers for these questions
        $stmt = $db->prepare("
            SELECT a.question_id, a.user_id, u.name AS user_name, u.phone, u.district,
                   a.chosen_answer, a.is_correct,
                   COALESCE(a.time_taken_ms, a.time_taken_seconds * 1000) AS time_ms
            FROM answers a
            JOIN quiz_sessions s ON s.id = a.session_id AND s.episode_id = ?
            JOIN users u ON u.id = a.user_id
            WHERE a.question_id IN ($ph)
        ");
        $stmt->execute([$id, ...$qIds]);
        $answers = $stmt->fetchAll();

        // Find fastest correct per question
        $qWinners = [];
        foreach ($answers as $a) {
            if (!$a['is_correct']) continue;
            $qid = $a['question_id'];
            if (!isset($qWinners[$qid]) || (int)$a['time_ms'] < (int)$qWinners[$qid]['time_ms']) {
                $qWinners[$qid] = $a;
            }
        }

        // Aggregate by user
        $users = [];
        foreach ($answers as $a) {
            $uid = $a['user_id'];
            if (!isset($users[$uid])) {
                $users[$uid] = [
                    'user_id' => (int)$uid,
                    'name'    => $a['user_name'],
                    'phone'   => $a['phone'],
                    'district'=> $a['district'],
                    'correct' => 0,
                    'answered'=> 0,
                    'total_ms'=> 0,
                    'answers' => [],
                    'won_q_ids' => [],
                ];
            }
            $users[$uid]['answered']++;
            if ($a['is_correct']) $users[$uid]['correct']++;
            $users[$uid]['total_ms'] += (int)$a['time_ms'];
            $users[$uid]['answers'][(int)$a['question_id']] = [
                'chosen'  => $a['chosen_answer'],
                'correct' => (bool)$a['is_correct'],
                'time_ms' => (int)$a['time_ms'],
            ];
        }

        // Mark winners
        foreach ($qWinners as $qid => $w) {
            if (isset($users[$w['user_id']])) {
                $users[$w['user_id']]['won_q_ids'][] = (int)$qid;
            }
        }

        // Sort & rank
        $sorted = array_values($users);
        usort($sorted, fn($a, $b) =>
            $b['correct'] !== $a['correct']
                ? $b['correct'] - $a['correct']
                : $a['total_ms'] - $b['total_ms']
        );
        foreach ($sorted as $i => &$p) {
            $p['rank'] = $i + 1;
            $p['is_selected'] = !empty($p['won_q_ids']);
            $p['won_q_ids'] = array_values($p['won_q_ids']);
        }
        unset($p);

        $roundsOut[] = [
            'id'                 => (int)$round['id'],
            'name'               => $round['name'],
            'type'               => 'mcq',
            'requires_selection' => (bool)$round['requires_selection'],
            'questions'          => array_map(fn($q) => ['id' => (int)$q['id'], 'text' => $q['question_text']], $qs),
            'participants'       => $sorted,
        ];
    }

    // ── Toss rounds (questions in `toss_questions` table) ───────────
    $stmt = $db->prepare("
        SELECT DISTINCT r.id, r.name, r.requires_selection
        FROM rounds r
        JOIN toss_questions tq ON tq.round_id = r.id AND tq.episode_id = ?
        ORDER BY r.id
    ");
    $stmt->execute([$id]);
    $tossRounds = $stmt->fetchAll();

    // Filter out rounds already added from MCQ
    $mcqRoundIds = array_column($mcqRounds, 'id');
    foreach ($tossRounds as $round) {
        if (in_array($round['id'], $mcqRoundIds)) continue;

        $stmt = $db->prepare("SELECT id, question_text, answer FROM toss_questions WHERE round_id = ? AND episode_id = ? ORDER BY id");
        $stmt->execute([$round['id'], $id]);
        $tqs = $stmt->fetchAll();

        $tqIds = array_column($tqs, 'id');
        if (empty($tqIds)) {
            $roundsOut[] = ['id' => (int)$round['id'], 'name' => $round['name'],
                'type' => 'toss', 'requires_selection' => (bool)$round['requires_selection'],
                'questions' => [], 'participants' => []];
            continue;
        }

        $ph = implode(',', array_fill(0, count($tqIds), '?'));
        $stmt = $db->prepare("
            SELECT ta.toss_question_id, ta.user_id, u.name AS user_name, u.phone, u.district,
                   ta.answer, ta.is_correct, ta.answered_at
            FROM toss_answers ta
            JOIN users u ON u.id = ta.user_id
            WHERE ta.toss_question_id IN ($ph) AND ta.episode_id = ?
            ORDER BY ta.is_correct DESC, ta.answered_at ASC
        ");
        $stmt->execute([...$tqIds, $id]);
        $tossAnswers = $stmt->fetchAll();

        $users = [];
        foreach ($tossAnswers as $a) {
            $uid = $a['user_id'];
            $users[$uid] = [
                'user_id'  => (int)$uid,
                'name'     => $a['user_name'],
                'phone'    => $a['phone'],
                'district' => $a['district'],
                'correct'  => (int)$a['is_correct'],
                'answered' => 1,
                'total_ms' => 0,
                'answers'  => [(int)$a['toss_question_id'] => [
                    'chosen'  => $a['answer'],
                    'correct' => (bool)$a['is_correct'],
                    'time_ms' => 0,
                ]],
                'won_q_ids'  => (bool)$a['is_correct'] ? [(int)$a['toss_question_id']] : [],
                'is_selected'=> (bool)$a['is_correct'],
            ];
        }

        $sorted = array_values($users);
        usort($sorted, fn($a, $b) => $b['correct'] - $a['correct']);
        foreach ($sorted as $i => &$p) { $p['rank'] = $i + 1; }
        unset($p);

        $roundsOut[] = [
            'id'                 => (int)$round['id'],
            'name'               => $round['name'],
            'type'               => 'toss',
            'requires_selection' => (bool)$round['requires_selection'],
            'questions'          => array_map(fn($q) => ['id' => (int)$q['id'], 'text' => $q['question_text']], $tqs),
            'participants'       => $sorted,
        ];
    }

    // Sort rounds by id
    usort($roundsOut, fn($a, $b) => $a['id'] - $b['id']);

    // Attach saved manual scores
    $stmt = $db->prepare("SELECT round_id, user_id, score, note FROM round_scores WHERE episode_id = ?");
    $stmt->execute([$id]);
    $savedScores = [];
    foreach ($stmt->fetchAll() as $s) {
        $savedScores[$s['round_id']][$s['user_id']] = ['score' => (float)$s['score'], 'note' => $s['note']];
    }
    foreach ($roundsOut as &$r) {
        foreach ($r['participants'] as &$p) {
            $s = $savedScores[$r['id']][$p['user_id']] ?? null;
            $p['manual_score'] = $s ? (float)$s['score'] : null;
            $p['score_note']   = $s['note'] ?? null;
        }
        unset($p);
    }
    unset($r);

    jsonResponse(['episode' => $episode, 'rounds' => $roundsOut]);
}

function episodeScoreSheet(int $id): void
{
    requireAuth();
    $db = getDB();

    $stmt = $db->prepare("SELECT * FROM episodes WHERE id = ?");
    $stmt->execute([$id]);
    $episode = $stmt->fetch();
    if (!$episode) errorResponse('Episode not found', 404);

    // Restricted rounds (requires_selection = 1) that have questions
    $stmt = $db->prepare("
        SELECT DISTINCT r.id, r.name, r.requires_selection
        FROM rounds r
        JOIN questions q ON q.round_id = r.id AND q.episode_id = ? AND q.is_active = 1
        WHERE r.requires_selection = 1
        ORDER BY r.id
    ");
    $stmt->execute([$id]);
    $rounds = $stmt->fetchAll();

    // Also include toss rounds (toss_questions table)
    $stmt = $db->prepare("
        SELECT DISTINCT r.id, r.name, r.requires_selection
        FROM rounds r
        JOIN toss_questions tq ON tq.round_id = r.id AND tq.episode_id = ?
        WHERE r.requires_selection = 1
        ORDER BY r.id
    ");
    $stmt->execute([$id]);
    foreach ($stmt->fetchAll() as $tr) {
        if (!in_array($tr['id'], array_column($rounds, 'id'))) {
            $rounds[] = $tr;
        }
    }
    usort($rounds, fn($a, $b) => $a['id'] - $b['id']);
    $roundIds = array_column($rounds, 'id');

    // Selected users: won at least one question in the selection round of this episode
    $stmt = $db->prepare("
        SELECT DISTINCT u.id AS user_id, u.name, u.phone, u.district
        FROM answers a
        JOIN quiz_sessions s ON s.id = a.session_id AND s.episode_id = ?
        JOIN users u ON u.id = a.user_id
        JOIN questions q ON q.id = a.question_id
        WHERE a.is_correct = 1
          AND COALESCE(a.time_taken_ms, a.time_taken_seconds * 1000) = (
              SELECT MIN(COALESCE(a2.time_taken_ms, a2.time_taken_seconds * 1000))
              FROM answers a2
              JOIN quiz_sessions s2 ON s2.id = a2.session_id
              WHERE s2.episode_id = ? AND a2.question_id = a.question_id AND a2.is_correct = 1
          )
        ORDER BY u.name
    ");
    $stmt->execute([$id, $id]);
    $selectedUsers = $stmt->fetchAll();

    // Saved manual scores for this episode
    $stmt = $db->prepare("SELECT round_id, user_id, score, note FROM round_scores WHERE episode_id = ?");
    $stmt->execute([$id]);
    $savedScores = [];
    foreach ($stmt->fetchAll() as $s) {
        $savedScores[(int)$s['round_id']][(int)$s['user_id']] = ['score' => (float)$s['score'], 'note' => $s['note']];
    }

    // Build user list with scores per round
    $users = [];
    foreach ($selectedUsers as $u) {
        $uid = (int)$u['user_id'];
        $scores = [];
        $total  = 0;
        foreach ($roundIds as $rid) {
            $s = $savedScores[$rid][$uid] ?? null;
            $scores[$rid] = ['score' => $s ? (float)$s['score'] : null, 'note' => $s['note'] ?? null];
            if ($s) $total += (float)$s['score'];
        }
        $users[] = [
            'user_id'     => $uid,
            'name'        => $u['name'],
            'phone'       => $u['phone'],
            'district'    => $u['district'] ?? '—',
            'scores'      => $scores,
            'total_score' => $total,
        ];
    }

    // District totals (from total_score across all rounds)
    $districtMap = [];
    foreach ($users as $u) {
        $d = $u['district'] ?: '—';
        if (!isset($districtMap[$d])) {
            $districtMap[$d] = ['district' => $d, 'players' => [], 'total_score' => 0];
        }
        $districtMap[$d]['players'][]   = $u;
        $districtMap[$d]['total_score'] += $u['total_score'];
    }
    foreach ($districtMap as &$dm) {
        usort($dm['players'], fn($a, $b) => $b['total_score'] - $a['total_score']);
        $dm['player_count'] = count($dm['players']);
        $dm['top_player']   = $dm['players'][0] ?? null;
    }
    unset($dm);
    $districts = array_values($districtMap);
    usort($districts, fn($a, $b) => $b['total_score'] - $a['total_score']);

    jsonResponse([
        'episode'   => $episode,
        'rounds'    => array_values($rounds),
        'users'     => $users,
        'districts' => $districts,
    ]);
}

function episodeUpsertRoundScore(): void
{
    requireAuth();
    $body      = getBody();
    $episodeId = (int)($body['episode_id'] ?? 0);
    $roundId   = (int)($body['round_id']   ?? 0);
    $userId    = (int)($body['user_id']    ?? 0);
    $score     = isset($body['score']) ? (float)$body['score'] : null;
    $note      = isset($body['note']) ? trim($body['note']) : null;

    if (!$episodeId || !$roundId || !$userId || $score === null) {
        errorResponse('episode_id, round_id, user_id, score are required', 422);
    }

    $db = getDB();
    $db->prepare("
        INSERT INTO round_scores (episode_id, round_id, user_id, score, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE score = VALUES(score), note = VALUES(note), updated_at = NOW()
    ")->execute([$episodeId, $roundId, $userId, $score, $note]);

    jsonResponse(['saved' => true, 'score' => $score, 'note' => $note]);
}
