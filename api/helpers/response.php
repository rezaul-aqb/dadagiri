<?php

function jsonResponse($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function errorResponse(string $message, int $status = 400): void
{
    jsonResponse(['error' => $message], $status);
}

function cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function getBody(): array
{
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function validate(array $data, array $rules): array
{
    $errors = [];
    foreach ($rules as $field => $rule) {
        $isRequired = strpos($rule, 'required') !== false;
        $value = $data[$field] ?? null;

        if ($isRequired && ($value === null || $value === '')) {
            $errors[$field] = ["The {$field} field is required."];
            continue;
        }

        if ($value !== null && strpos($rule, 'email') !== false) {
            if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $errors[$field] = ["The {$field} must be a valid email."];
            }
        }

        if ($value !== null && preg_match('/in:([^|]+)/', $rule, $m)) {
            $allowed = explode(',', $m[1]);
            if (!in_array($value, $allowed)) {
                $errors[$field] = ["The {$field} must be one of: {$m[1]}."];
            }
        }
    }
    return $errors;
}
