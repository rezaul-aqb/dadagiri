-- Dadagiri Quiz Database Setup
CREATE DATABASE IF NOT EXISTS dadagiri CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dadagiri;

-- Users (quiz participants + admin)
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NULL,
    phone         VARCHAR(20) UNIQUE NULL,
    district      VARCHAR(100) NULL,
    is_admin      TINYINT(1) DEFAULT 0,
    password      VARCHAR(255) NOT NULL,
    remember_token VARCHAR(100) NULL,
    created_at    TIMESTAMP NULL,
    updated_at    TIMESTAMP NULL
);

-- API tokens (replaces Laravel Sanctum table)
CREATE TABLE IF NOT EXISTS personal_access_tokens (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tokenable_type VARCHAR(255) NOT NULL,
    tokenable_id   BIGINT UNSIGNED NOT NULL,
    name           VARCHAR(255) NOT NULL,
    token          VARCHAR(64) NOT NULL UNIQUE,
    abilities      TEXT NULL,
    last_used_at   TIMESTAMP NULL,
    created_at     TIMESTAMP NULL,
    updated_at     TIMESTAMP NULL,
    INDEX idx_tokenable (tokenable_type, tokenable_id)
);

-- Quiz questions
CREATE TABLE IF NOT EXISTS questions (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_text  TEXT NOT NULL,
    option_a       VARCHAR(500) NOT NULL,
    option_b       VARCHAR(500) NOT NULL,
    option_c       VARCHAR(500) NOT NULL,
    option_d       VARCHAR(500) NOT NULL,
    correct_answer ENUM('A','B','C','D') NOT NULL,
    `order`        INT DEFAULT 0,
    is_active      TINYINT(1) DEFAULT 1,
    created_at     TIMESTAMP NULL,
    updated_at     TIMESTAMP NULL
);

-- Quiz sessions (one per participant attempt)
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT UNSIGNED NOT NULL,
    status              ENUM('started','completed','abandoned') DEFAULT 'started',
    started_at          TIMESTAMP NULL,
    completed_at        TIMESTAMP NULL,
    total_correct       INT DEFAULT 0,
    total_time_seconds  INT DEFAULT 0,
    published           TINYINT(1) DEFAULT 0,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Individual answers
CREATE TABLE IF NOT EXISTS answers (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id          BIGINT UNSIGNED NOT NULL,
    user_id             BIGINT UNSIGNED NOT NULL,
    question_id         BIGINT UNSIGNED NOT NULL,
    chosen_answer       ENUM('A','B','C','D') NULL,
    is_correct          TINYINT(1) DEFAULT 0,
    time_taken_seconds  INT DEFAULT 0,
    answered_at         TIMESTAMP NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    FOREIGN KEY (session_id)  REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Default admin account (password: admin123)
INSERT IGNORE INTO users (name, email, phone, district, is_admin, password, created_at, updated_at)
VALUES (
    'Admin',
    'admin@dadagiri.com',
    NULL,
    NULL,
    1,
    '$2y$10$OSJEwM.a2qOk.Bco22KXv.nd.mGbmjzSDFdtmDUPOM8YuhAUDrUQm',
    NOW(),
    NOW()
);
