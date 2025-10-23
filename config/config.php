<?php
// Database configuration
define('DB_PATH', __DIR__ . '/../data/app.sqlite');
define('DATA_DIR', __DIR__ . '/../data');

// Session configuration - FIXED
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.use_strict_mode', 1);
ini_set('session.cookie_lifetime', 86400); // 24 hours
ini_set('session.gc_maxlifetime', 86400);
date_default_timezone_set('America/New_York');

// Disable output that breaks JSON
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Create data directory
if (!file_exists(DATA_DIR)) {
    @mkdir(DATA_DIR, 0775, true);
}

// Initialize database if missing
if (!file_exists(DB_PATH)) {
    require_once __DIR__ . '/../api/init_db.php';
}

function getDb() {
    try {
        $db = new PDO('sqlite:' . DB_PATH);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        
        // CRITICAL: Increase timeout and enable WAL mode
        $db->exec('PRAGMA busy_timeout = 10000');  // 10 seconds
        $db->exec('PRAGMA journal_mode = WAL');    // Write-Ahead Logging (prevents locks)
        $db->exec('PRAGMA synchronous = NORMAL');  // Faster writes
        
        return $db;
    } catch (PDOException $e) {
        error_log('Database connection failed: ' . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Database connection failed']);
        exit;
    }
}

function startSession() {
    if (session_status() === PHP_SESSION_NONE) {
        // Use a consistent session save path
        $sessionPath = DATA_DIR . '/sessions';
        if (!file_exists($sessionPath)) {
            @mkdir($sessionPath, 0700, true);
        }
        session_save_path($sessionPath);
        session_start();
    }
}

// FIXED: When assigning chores, make them available immediately
// The recurrence interval will be applied AFTER the chore is completed
function calculateNextDue($recurrenceType) {
    // Return current time so chores are available to complete right away
    return date('Y-m-d H:i:s');
}
?>
