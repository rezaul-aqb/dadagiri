<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/db.php';
require_once __DIR__ . '/middleware/auth.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/EpisodeController.php';
require_once __DIR__ . '/controllers/QuizController.php';
require_once __DIR__ . '/controllers/QuestionController.php';
require_once __DIR__ . '/controllers/ResultController.php';
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/AdminUserController.php';
require_once __DIR__ . '/controllers/ImportController.php';
require_once __DIR__ . '/controllers/RoundController.php';
require_once __DIR__ . '/controllers/TossController.php';

cors();

$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$base = '/dadagiri/api';
$path = strpos($uri, $base) === 0 ? substr($uri, strlen($base)) : $uri;
$path = rtrim($path, '/') ?: '/';

// ── Router ──────────────────────────────────────────────

// Public: User registration & lookup
if ($method === 'POST' && $path === '/register')     { userRegister(); }
if ($method === 'GET'  && $path === '/user/lookup')  { userLookup(); }
if ($method === 'PUT'  && $path === '/user/update')  { userUpdate(); }

// Quiz (public)
if ($method === 'GET'  && $path === '/quiz/live')           { quizLiveQuestion(); }
if ($method === 'GET'  && $path === '/quiz/active-episode') { quizActiveEpisode(); }
if ($method === 'POST' && $path === '/quiz/start')          { quizStart(); }
if ($method === 'POST' && $path === '/quiz/submit')         { quizSubmit(); }
if ($method === 'POST' && $path === '/quiz/answer')         { quizSingleAnswer(); }
if ($method === 'POST' && $path === '/quiz/complete')       { quizComplete(); }
if ($method === 'GET'  && $path === '/quiz/result')         { quizResult(); }

// Public: Admin auth
if ($method === 'POST' && $path === '/admin/login')  { adminLogin(); }
if ($method === 'POST' && $path === '/admin/logout') { adminLogout(); }
if ($method === 'GET'  && $path === '/admin/me')     { adminMe(); }

// Episodes
if ($method === 'GET'    && $path === '/episodes')                              { episodesIndex(); }
if ($method === 'POST'   && $path === '/episodes')                              { episodesStore(); }
if ($method === 'GET'    && preg_match('#^/episodes/(\d+)$#', $path, $m))      { episodesShow((int)$m[1]); }
if ($method === 'PUT'    && preg_match('#^/episodes/(\d+)$#', $path, $m))      { episodesUpdate((int)$m[1]); }
if ($method === 'DELETE' && preg_match('#^/episodes/(\d+)$#', $path, $m))      { episodesDestroy((int)$m[1]); }
if ($method === 'GET'    && preg_match('#^/episodes/(\d+)/analysis$#', $path, $m))      { episodeAnalysis((int)$m[1]); }
if ($method === 'GET'    && preg_match('#^/episodes/(\d+)/participants$#', $path, $m))  { episodeParticipants((int)$m[1]); }
if ($method === 'GET'    && preg_match('#^/episodes/(\d+)/round-scores$#', $path, $m)) { episodeRoundScores((int)$m[1]); }
if ($method === 'GET'    && preg_match('#^/episodes/(\d+)/score-sheet$#',  $path, $m)) { episodeScoreSheet((int)$m[1]); }
if ($method === 'POST'   && $path === '/round-scores/update')                          { episodeUpsertRoundScore(); }
if ($method === 'GET'    && $path === '/district-scores')                               { districtScores(); }

// Questions (filterable by ?episode_id=)
if ($method === 'GET'    && $path === '/questions')                             { questionsIndex(); }
if ($method === 'POST'   && $path === '/questions')                             { questionsStore(); }
if ($method === 'GET'    && preg_match('#^/questions/(\d+)$#', $path, $m))     { questionsShow((int)$m[1]); }
if ($method === 'PUT'    && preg_match('#^/questions/(\d+)$#', $path, $m))     { questionsUpdate((int)$m[1]); }
if ($method === 'DELETE' && preg_match('#^/questions/(\d+)$#', $path, $m))     { questionsDestroy((int)$m[1]); }
if ($method === 'POST'   && $path === '/questions/reorder')                                    { questionsReorder(); }
if ($method === 'POST'   && preg_match('#^/questions/(\d+)/image$#', $path, $m))               { questionsUploadImage((int)$m[1]); }
if ($method === 'DELETE' && preg_match('#^/questions/(\d+)/image$#', $path, $m))               { questionsDeleteImage((int)$m[1]); }
if ($method === 'POST'   && preg_match('#^/questions/(\d+)/answer-image$#', $path, $m))        { questionsUploadAnswerImage((int)$m[1]); }
if ($method === 'DELETE' && preg_match('#^/questions/(\d+)/answer-image$#', $path, $m))        { questionsDeleteAnswerImage((int)$m[1]); }
if ($method === 'GET'    && preg_match('#^/questions/(\d+)/result$#', $path, $m))               { questionResults((int)$m[1]); }
if ($method === 'POST'   && preg_match('#^/questions/(\d+)/live$#', $path, $m))                { questionsGoLive((int)$m[1]); }
if ($method === 'POST'   && preg_match('#^/questions/(\d+)/toggle-option$#', $path, $m))      { questionsToggleOption((int)$m[1]); }
if ($method === 'DELETE' && $path === '/questions/live')                                        { questionsStopLive(); }

// Import
if ($method === 'POST'   && $path === '/admin/questions/import')                { questionsImport(); }

// Rounds
if ($method === 'GET' && $path === '/rounds')                                        { roundsIndex(); }
if ($method === 'PUT' && preg_match('#^/rounds/(\d+)/status$#', $path, $m))         { roundsUpdateStatus((int)$m[1]); }

// Toss Round
if ($method === 'GET'    && $path === '/toss/live')                                           { tossLive(); }
if ($method === 'GET'    && $path === '/toss/eligibility')                                    { tossEligibility(); }
if ($method === 'POST'   && $path === '/toss/answer')                                         { tossSubmitAnswer(); }
if ($method === 'GET'    && $path === '/toss-questions')                                      { tossIndex(); }
if ($method === 'POST'   && $path === '/toss-questions')                                      { tossStore(); }
if ($method === 'PUT'    && preg_match('#^/toss-questions/(\d+)$#', $path, $m))              { tossUpdate((int)$m[1]); }
if ($method === 'DELETE' && preg_match('#^/toss-questions/(\d+)$#', $path, $m))              { tossDestroy((int)$m[1]); }
if ($method === 'POST'   && preg_match('#^/toss-questions/(\d+)/live$#', $path, $m))         { tossGoLive((int)$m[1]); }
if ($method === 'DELETE' && $path === '/toss-questions/live')                                 { tossStopLive(); }
if ($method === 'POST'   && preg_match('#^/toss-questions/(\d+)/toggle-hint$#', $path, $m))   { tossToggleHint((int)$m[1]); }
if ($method === 'POST'   && preg_match('#^/toss-questions/(\d+)/reset-hints$#', $path, $m))  { tossResetHints((int)$m[1]); }

// Admin users
if ($method === 'GET'    && $path === '/admin/users')                           { adminUsersIndex(); }
if ($method === 'GET'    && preg_match('#^/admin/users/(\d+)$#', $path, $m))   { adminUserShow((int)$m[1]); }

// Results (filterable by ?episode_id=)
if ($method === 'GET'  && $path === '/results/stats')    { resultsStats(); }
if ($method === 'GET'  && $path === '/results')          { resultsIndex(); }
if ($method === 'POST' && $path === '/results/publish')  { resultsPublish(); }
if ($method === 'POST' && $path === '/results/unpublish'){ resultsUnpublish(); }

errorResponse('Not found', 404);
