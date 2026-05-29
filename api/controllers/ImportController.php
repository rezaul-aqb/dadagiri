<?php

function questionsImport(): void
{
    requireAuth();

    $episodeId = (int)($_POST['episode_id'] ?? 0);
    if (!$episodeId) {
        errorResponse('episode_id is required', 422);
        return;
    }

    $db   = getDB();
    $stmt = $db->prepare("SELECT id FROM episodes WHERE id = ?");
    $stmt->execute([$episodeId]);
    if (!$stmt->fetch()) {
        errorResponse('Episode not found', 404);
        return;
    }

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        errorResponse('No file uploaded or upload error', 422);
        return;
    }

    $tmpPath  = $_FILES['file']['tmp_name'];
    $origName = $_FILES['file']['name'];
    $ext      = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

    if (!in_array($ext, ['csv', 'xlsx'])) {
        errorResponse('Only .csv and .xlsx files are supported', 422);
        return;
    }

    try {
        $rows = $ext === 'xlsx' ? parseXlsxFile($tmpPath) : parseCsvFile($tmpPath);
    } catch (\Exception $e) {
        errorResponse('Failed to parse file: ' . $e->getMessage(), 422);
        return;
    }

    if (empty($rows)) {
        errorResponse('The file appears to be empty', 422);
        return;
    }

    // Skip header row — detect by checking if the row doesn't look like real data
    $first = array_map('strtolower', array_map('trim', $rows[0]));
    $looksLikeHeader =
        str_contains($first[0] ?? '', 'question') ||
        str_contains($first[0] ?? '', 'q.no')     ||
        str_contains($first[0] ?? '', 'sl')        ||
        str_contains($first[0] ?? '', 'no')        ||
        str_contains($first[0] ?? '', 'serial')    ||
        $first[0] === '#'                           ||
        !is_numeric(str_replace([' ','.'], '', $first[5] ?? 'x')) &&
        in_array($first[5] ?? '', ['a','b','c','d','correct','answer','ans',
                                   'correct answer','correct_answer']);
    if ($looksLikeHeader) {
        array_shift($rows);
        $rowNum = 2;
    }

    // Current max order for this episode
    $stmt = $db->prepare("SELECT COALESCE(MAX(`order`), 0) FROM questions WHERE episode_id = ?");
    $stmt->execute([$episodeId]);
    $orderStart = (int)$stmt->fetchColumn() + 1;

    $inserted   = 0;
    $skipped    = [];
    $rowNum     = 2;

    $insertStmt = $db->prepare("
        INSERT INTO questions
            (episode_id, question_text, option_a, option_b, option_c, option_d,
             correct_answer, `order`, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    ");

    foreach ($rows as $row) {
        while (count($row) < 6) $row[] = '';

        [$qText, $optA, $optB, $optC, $optD, $correct] = array_slice($row, 0, 6);

        // Normalise correct answer — accept A/B/C/D or 1/2/3/4
        $correct = strtoupper(trim($correct));
        $numMap  = ['1' => 'A', '2' => 'B', '3' => 'C', '4' => 'D'];
        if (isset($numMap[$correct])) $correct = $numMap[$correct];

        $errs = [];
        if (empty(trim($qText)))                       $errs[] = 'question text missing';
        if (empty(trim($optA)))                        $errs[] = 'option 1 missing';
        if (empty(trim($optB)))                        $errs[] = 'option 2 missing';
        if (empty(trim($optC)))                        $errs[] = 'option 3 missing';
        if (empty(trim($optD)))                        $errs[] = 'option 4 missing';
        if (!in_array($correct, ['A','B','C','D']))    $errs[] = 'correct answer must be A/B/C/D or 1/2/3/4';

        if ($errs) {
            $skipped[] = "Row $rowNum: " . implode(', ', $errs);
            $rowNum++;
            continue;
        }

        $insertStmt->execute([
            $episodeId,
            trim($qText),
            trim($optA), trim($optB), trim($optC), trim($optD),
            $correct,
            $orderStart + $inserted,
        ]);
        $inserted++;
        $rowNum++;
    }

    jsonResponse([
        'inserted' => $inserted,
        'skipped'  => $skipped,
        'message'  => "$inserted question(s) imported" .
                      (count($skipped) ? ', ' . count($skipped) . ' row(s) skipped' : ''),
    ]);
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCsvFile(string $path): array
{
    $rows = [];
    $fp   = fopen($path, 'r');
    if (!$fp) throw new \RuntimeException('Cannot open CSV file');
    while (($row = fgetcsv($fp)) !== false) {
        $rows[] = array_map('trim', $row);
    }
    fclose($fp);
    return $rows;
}

// ── Pure-PHP XLSX parser (no Composer needed) ─────────────────────────────────

function parseXlsxFile(string $path): array
{
    if (!class_exists('ZipArchive')) {
        throw new \RuntimeException('ZipArchive PHP extension is required for xlsx parsing');
    }

    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        throw new \RuntimeException('Cannot open xlsx file — make sure it is a valid Excel file');
    }

    // Build shared-strings lookup
    $sharedStrings = [];
    $ssData = $zip->getFromName('xl/sharedStrings.xml');
    if ($ssData) {
        $ss = simplexml_load_string($ssData);
        if ($ss) {
            foreach ($ss->si as $si) {
                if (isset($si->t)) {
                    $sharedStrings[] = (string)$si->t;
                } else {
                    $text = '';
                    foreach ($si->r as $r) {
                        $text .= (string)$r->t;
                    }
                    $sharedStrings[] = $text;
                }
            }
        }
    }

    // Try sheet1; fall back to first sheet in workbook
    $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
    if (!$sheetXml) {
        // Try to find the first sheet via workbook relationships
        $relsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');
        if ($relsXml) {
            $rels = simplexml_load_string($relsXml);
            foreach ($rels->Relationship as $rel) {
                if (str_contains((string)$rel['Type'], 'worksheet')) {
                    $target = 'xl/' . ltrim((string)$rel['Target'], '/');
                    $sheetXml = $zip->getFromName($target);
                    if ($sheetXml) break;
                }
            }
        }
    }

    $zip->close();

    if (!$sheetXml) {
        throw new \RuntimeException('Cannot find worksheet data inside the xlsx file');
    }

    $sheet = simplexml_load_string($sheetXml);
    if (!$sheet) {
        throw new \RuntimeException('Cannot parse xlsx sheet XML');
    }

    $rows = [];

    foreach ($sheet->sheetData->row as $xmlRow) {
        $rowData = [];
        $colIdx  = 0;

        foreach ($xmlRow->c as $cell) {
            // Decode column letter(s) → 0-based index
            preg_match('/^([A-Z]+)/', (string)$cell['r'], $m);
            $colNum = 0;
            foreach (str_split($m[1]) as $ch) {
                $colNum = $colNum * 26 + (ord($ch) - 64);
            }
            $colNum--;

            // Fill any skipped columns with empty string
            while ($colIdx < $colNum) { $rowData[] = ''; $colIdx++; }

            $type  = (string)$cell['t'];
            $value = isset($cell->v) ? (string)$cell->v : '';

            if ($type === 's') {
                $value = $sharedStrings[(int)$value] ?? '';
            } elseif ($type === 'inlineStr') {
                $value = isset($cell->is->t) ? (string)$cell->is->t : '';
            } elseif ($type === 'b') {
                $value = $value === '1' ? 'TRUE' : 'FALSE';
            }

            $rowData[] = trim($value);
            $colIdx++;
        }

        if (!empty(array_filter($rowData, fn($v) => $v !== ''))) {
            $rows[] = $rowData;
        }
    }

    return $rows;
}
