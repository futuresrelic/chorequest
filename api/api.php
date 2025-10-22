<?php
// Close database on shutdown to prevent locks
register_shutdown_function(function() {
    global $db;
    $db = null;
});
error_log("LIVE api.php loaded at " . date('c'));
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

require_once __DIR__ . '/../config/config.php';

// Start session
startSession();

// Get request data
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';

// Helper functions
function jsonResponse($ok, $data = null, $error = null) {
    echo json_encode([
        'ok' => $ok,
        'data' => $data,
        'error' => $error
    ]);
    exit;
}

function sanitize($str, $maxLen = 2000) {
    return substr(trim($str), 0, $maxLen);
}

function requireAdmin() {
    if (!isset($_SESSION['admin_id'])) {
        jsonResponse(false, null, 'Unauthorized');
    }
    
    // Return admin info for use in the calling code
    $db = getDb();
    $stmt = $db->prepare("SELECT id as user_id, email FROM users WHERE id = ? AND role = 'admin'");
    $stmt->execute([$_SESSION['admin_id']]);
    $admin = $stmt->fetch();
    
    if (!$admin) {
        jsonResponse(false, null, 'Unauthorized');
    }
    
    return $admin;
}

function getKidFromToken() {
    // Try session first (workaround for cookie blocking)
    $token = $_SESSION['kid_token'] ?? $_COOKIE['kid_token'] ?? '';
    if (!$token) return null;
    
    $db = getDb();
    $stmt = $db->prepare("
        SELECT d.kid_user_id, u.kid_name, u.total_points 
        FROM devices d 
        JOIN users u ON d.kid_user_id = u.id 
        WHERE d.device_token = ? AND d.paired_at IS NOT NULL
    ");
    $stmt->execute([$token]);
    return $stmt->fetch();
}

function requireKid() {
    $kid = getKidFromToken();
    if (!$kid) {
        jsonResponse(false, null, 'Unauthorized');
    }
    return $kid;
}

function checkRateLimit($action, $maxAttempts = 5, $windowMinutes = 1) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $db = getDb();
    
    // Clean old entries
    $db->exec("DELETE FROM rate_limits WHERE datetime(window_start, '+" . $windowMinutes . " minutes') < datetime('now')");
    
    // Check current
    $stmt = $db->prepare("SELECT attempt_count FROM rate_limits WHERE ip_address = ? AND action = ?");
    $stmt->execute([$ip, $action]);
    $row = $stmt->fetch();
    
    if ($row && $row['attempt_count'] >= $maxAttempts) {
        jsonResponse(false, null, 'Rate limit exceeded. Try again later.');
    }
    
    // Increment
    $stmt = $db->prepare("
        INSERT OR REPLACE INTO rate_limits (ip_address, action, attempt_count, window_start) 
        VALUES (?, ?, COALESCE((SELECT attempt_count FROM rate_limits WHERE ip_address = ? AND action = ?), 0) + 1, 
                COALESCE((SELECT window_start FROM rate_limits WHERE ip_address = ? AND action = ?), datetime('now')))
    ");
    $stmt->execute([$ip, $action, $ip, $action, $ip, $action]);
}

function logAudit($userId, $action, $meta = []) {
    $db = getDb();
    $stmt = $db->prepare("INSERT INTO audit_log (actor_user_id, action, meta_json) VALUES (?, ?, ?)");
    $stmt->execute([$userId, $action, json_encode($meta)]);
}

function generateCode($length = 6) {
    return strtoupper(substr(str_shuffle('0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'), 0, $length));
}

function generateToken() {
    return bin2hex(random_bytes(32));
}

function calculateNextDue($frequency) {
    $now = new DateTime();
    switch ($frequency) {
        case 'daily':
            return $now->modify('+1 day')->setTime(7, 0)->format('Y-m-d H:i:s');
            break;  // ADD THIS
        case 'weekly':
            return $now->modify('next Monday')->setTime(7, 0)->format('Y-m-d H:i:s');
            break;  // ADD THIS
        case 'once':
            return $now->modify('+1 day')->setTime(7, 0)->format('Y-m-d H:i:s');
            break;  // ADD THIS
        default:
            return $now->modify('+1 day')->setTime(7, 0)->format('Y-m-d H:i:s');
    }
}

// Route actions
switch ($action) {
    
    case 'admin_login':
        checkRateLimit('admin_login', 25, 5);
        
        $email = sanitize($input['email'] ?? '', 100);
        $password = $input['password'] ?? '';
        
        if (!$email || !$password) {
            jsonResponse(false, null, 'Email and password required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND role = 'admin'");
        $stmt->execute([$email]);
        $admin = $stmt->fetch();
        
        if (!$admin || !password_verify($password, $admin['password_hash'])) {
            jsonResponse(false, null, 'Invalid credentials');
        }
        
        $_SESSION['admin_id'] = $admin['id'];
        $_SESSION['admin_email'] = $admin['email'];
        
        logAudit($admin['id'], 'admin_login', ['email' => $email]);
        
        jsonResponse(true, [
            'id' => $admin['id'],
            'email' => $admin['email']
        ]);
        break;
    
    case 'admin_logout':
        requireAdmin();
        $adminId = $_SESSION['admin_id'];
        session_destroy();
        logAudit($adminId, 'admin_logout', []);
        jsonResponse(true, ['message' => 'Logged out']);
        break;
    
    case 'admin_me':
        requireAdmin();
        jsonResponse(true, [
            'id' => $_SESSION['admin_id'],
            'email' => $_SESSION['admin_email']
        ]);
        break;
    
    case 'admin_change_password':
        requireAdmin();
        
        $currentPassword = $input['current_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';
        
        if (strlen($newPassword) < 8) {
            jsonResponse(false, null, 'New password must be at least 8 characters');
        }
        
        $db = getDb();
        $stmt = $db->prepare("SELECT password_hash FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['admin_id']]);
        $admin = $stmt->fetch();
        
        if (!password_verify($currentPassword, $admin['password_hash'])) {
            jsonResponse(false, null, 'Current password is incorrect');
        }
        
        $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmt = $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $stmt->execute([$newHash, $_SESSION['admin_id']]);
        
        logAudit($_SESSION['admin_id'], 'password_changed', []);
        jsonResponse(true, ['message' => 'Password updated']);
        break;
    
    case 'create_kid':
        requireAdmin();
        
        $name = sanitize($input['name'] ?? '', 100);
        if (!$name) {
            jsonResponse(false, null, 'Name is required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("INSERT INTO users (role, kid_name) VALUES ('kid', ?)");
        $stmt->execute([$name]);
        $kidId = $db->lastInsertId();
        
        logAudit($_SESSION['admin_id'], 'create_kid', ['kid_id' => $kidId, 'name' => $name]);
        jsonResponse(true, ['id' => $kidId, 'name' => $name]);
        break;
    
    case 'list_kids':
        requireAdmin();
        
        $db = getDb();
        $stmt = $db->query("
            SELECT u.id, u.kid_name, u.total_points, u.created_at,
                   COUNT(DISTINCT d.id) as device_count,
                   COUNT(DISTINCT kc.id) as chore_count
            FROM users u
            LEFT JOIN devices d ON u.id = d.kid_user_id AND d.paired_at IS NOT NULL
            LEFT JOIN kid_chores kc ON u.id = kc.kid_user_id
            WHERE u.role = 'kid'
            GROUP BY u.id
            ORDER BY u.kid_name
        ");
        
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'delete_kid':
        requireAdmin();
        
        $kidId = intval($input['kid_id'] ?? 0);
        if (!$kidId) {
            jsonResponse(false, null, 'Kid ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("DELETE FROM users WHERE id = ? AND role = 'kid'");
        $stmt->execute([$kidId]);
        
        logAudit($_SESSION['admin_id'], 'delete_kid', ['kid_id' => $kidId]);
        jsonResponse(true, ['message' => 'Kid deleted']);
        break;
    
    case 'generate_pairing_code':
        requireAdmin();
        
        $kidId = intval($input['kid_id'] ?? 0);
        if (!$kidId) {
            jsonResponse(false, null, 'Kid ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("SELECT id FROM users WHERE id = ? AND role = 'kid'");
        $stmt->execute([$kidId]);
        if (!$stmt->fetch()) {
            jsonResponse(false, null, 'Kid not found');
        }
        
        $code = generateCode();
        $stmt = $db->prepare("INSERT INTO devices (kid_user_id, pairing_code, device_label) VALUES (?, ?, 'Pending')");
        $stmt->execute([$kidId, $code]);
        
        logAudit($_SESSION['admin_id'], 'generate_pairing_code', ['kid_id' => $kidId, 'code' => $code]);
        jsonResponse(true, ['code' => $code, 'kid_id' => $kidId]);
        break;
    
    case 'list_pairing_codes':
        requireAdmin();
        
        $db = getDb();
        $stmt = $db->query("
            SELECT d.id, d.pairing_code, d.device_label, d.paired_at, u.kid_name, u.id as kid_id
            FROM devices d
            JOIN users u ON d.kid_user_id = u.id
            WHERE d.paired_at IS NULL
            ORDER BY d.id DESC
        ");
        
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'list_devices':
        requireAdmin();
        
        $db = getDb();
        $stmt = $db->query("
            SELECT d.id, d.device_label, d.paired_at, d.last_seen_at, u.kid_name, u.id as kid_id
            FROM devices d
            JOIN users u ON d.kid_user_id = u.id
            WHERE d.paired_at IS NOT NULL
            ORDER BY d.last_seen_at DESC
        ");
        
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'revoke_device':
        requireAdmin();
        
        $deviceId = intval($input['device_id'] ?? 0);
        if (!$deviceId) {
            jsonResponse(false, null, 'Device ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("DELETE FROM devices WHERE id = ?");
        $stmt->execute([$deviceId]);
        
        logAudit($_SESSION['admin_id'], 'revoke_device', ['device_id' => $deviceId]);
        jsonResponse(true, ['message' => 'Device revoked']);
        break;
    
    case 'pair_device':
    checkRateLimit('pair_device', 5, 1);
    
    $code = strtoupper(sanitize($input['code'] ?? '', 10));
    $deviceLabel = sanitize($input['device_label'] ?? 'Unknown Device', 100);
    
    if (!$code) {
        jsonResponse(false, null, 'Pairing code required');
    }
    
    $db = getDb();
    $stmt = $db->prepare("SELECT * FROM devices WHERE pairing_code = ? AND paired_at IS NULL");
    $stmt->execute([$code]);
    $device = $stmt->fetch();
    
    if (!$device) {
        jsonResponse(false, null, 'Invalid or expired pairing code');
    }
    
    $token = generateToken();
    $stmt = $db->prepare("UPDATE devices SET device_token = ?, paired_at = datetime('now'), device_label = ? WHERE id = ?");
    $stmt->execute([$token, $deviceLabel, $device['id']]);
    
    // WORKAROUND: Use session instead of cookie
    $_SESSION['kid_token'] = $token;
    
    $stmt = $db->prepare("SELECT id, kid_name FROM users WHERE id = ?");
    $stmt->execute([$device['kid_user_id']]);
    $kid = $stmt->fetch();
    
    logAudit($kid['id'], 'device_paired', ['code' => $code]);
    jsonResponse(true, ['kid_id' => $kid['id'], 'kid_name' => $kid['kid_name'], 'token' => $token]);
    break;
    
    case 'kid_me':
        $kid = requireKid();
        
        $token = $_COOKIE['kid_token'] ?? '';
        $db = getDb();
        $stmt = $db->prepare("UPDATE devices SET last_seen_at = datetime('now') WHERE device_token = ?");
        $stmt->execute([$token]);
        
        jsonResponse(true, [
            'kid_id' => $kid['kid_user_id'],
            'kid_name' => $kid['kid_name'],
            'total_points' => $kid['total_points']
        ]);
        break;
    
    case 'create_chore':
        requireAdmin();
        
        $title = sanitize($input['title'] ?? '', 100);
        $description = sanitize($input['description'] ?? '', 2000);
        $isRecurring = intval($input['is_recurring'] ?? 1);
        $frequency = in_array($input['frequency'] ?? '', ['daily', 'weekly', 'once']) ? $input['frequency'] : 'daily';
        $defaultPoints = intval($input['default_points'] ?? 10);
        $requiresApproval = intval($input['requires_approval'] ?? 1);
        
        if (!$title) {
            jsonResponse(false, null, 'Title is required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            INSERT INTO chores (title, description, is_recurring, frequency, default_points, requires_approval, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$title, $description, $isRecurring, $frequency, $defaultPoints, $requiresApproval, $_SESSION['admin_id']]);
        $choreId = $db->lastInsertId();
        
        logAudit($_SESSION['admin_id'], 'create_chore', ['chore_id' => $choreId, 'title' => $title]);
        jsonResponse(true, ['id' => $choreId]);
        break;
    
    case 'list_chores':
        requireAdmin();
        
        $db = getDb();
        $stmt = $db->query("
            SELECT c.*, 
                   COUNT(DISTINCT kc.kid_user_id) as assigned_count
            FROM chores c
            LEFT JOIN kid_chores kc ON c.id = kc.chore_id
            GROUP BY c.id
            ORDER BY c.created_at DESC
        ");
        
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'delete_chore':
        requireAdmin();
        
        $choreId = intval($input['chore_id'] ?? 0);
        if (!$choreId) {
            jsonResponse(false, null, 'Chore ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("DELETE FROM chores WHERE id = ?");
        $stmt->execute([$choreId]);
        
        logAudit($_SESSION['admin_id'], 'delete_chore', ['chore_id' => $choreId]);
        jsonResponse(true, ['message' => 'Chore deleted']);
        break;
    
    case 'assign_chore_to_kid':
        requireAdmin();
        
        $kidId = intval($input['kid_id'] ?? 0);
        $choreId = intval($input['chore_id'] ?? 0);
        
        if (!$kidId || !$choreId) {
            jsonResponse(false, null, 'Kid ID and Chore ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("SELECT frequency FROM chores WHERE id = ?");
        $stmt->execute([$choreId]);
        $chore = $stmt->fetch();
        
        if (!$chore) {
            jsonResponse(false, null, 'Chore not found');
        }
        
        $nextDue = calculateNextDue($chore['frequency']);
        
        $stmt = $db->prepare("
            INSERT OR IGNORE INTO kid_chores (kid_user_id, chore_id, next_due_at) 
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$kidId, $choreId, $nextDue]);
        
        logAudit($_SESSION['admin_id'], 'assign_chore', ['kid_id' => $kidId, 'chore_id' => $choreId]);
        jsonResponse(true, ['message' => 'Chore assigned']);
        break;
    
    case 'unassign_chore':
        requireAdmin();
        
        $kidId = intval($input['kid_id'] ?? 0);
        $choreId = intval($input['chore_id'] ?? 0);
        
        if (!$kidId || !$choreId) {
            jsonResponse(false, null, 'Kid ID and Chore ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("DELETE FROM kid_chores WHERE kid_user_id = ? AND chore_id = ?");
        $stmt->execute([$kidId, $choreId]);
        
        logAudit($_SESSION['admin_id'], 'unassign_chore', ['kid_id' => $kidId, 'chore_id' => $choreId]);
        jsonResponse(true, ['message' => 'Chore unassigned']);
        break;
    
    case 'list_kid_chores':
        $kidId = intval($input['kid_id'] ?? 0);
        
        if (isset($_SESSION['admin_id'])) {
            // Admin viewing
        } else {
            $kid = requireKid();
            $kidId = $kid['kid_user_id'];
        }
        
        if (!$kidId) {
            jsonResponse(false, null, 'Kid ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            SELECT kc.*, c.title, c.description, c.is_recurring, c.frequency, 
                   c.default_points, c.requires_approval,
                   CASE 
                       WHEN datetime(kc.next_due_at) <= datetime('now') THEN 1 
                       ELSE 0 
                   END as is_due
            FROM kid_chores kc
            JOIN chores c ON kc.chore_id = c.id
            WHERE kc.kid_user_id = ?
            ORDER BY is_due DESC, kc.next_due_at
        ");
        $stmt->execute([$kidId]);
        
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'submit_chore_completion':
        $kid = requireKid();
        
        $choreId = intval($input['chore_id'] ?? 0);
        $note = sanitize($input['note'] ?? '', 500);
        
        if (!$choreId) {
            jsonResponse(false, null, 'Chore ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            SELECT kc.*, c.requires_approval, c.default_points, c.is_recurring, c.frequency
            FROM kid_chores kc
            JOIN chores c ON kc.chore_id = c.id
            WHERE kc.kid_user_id = ? AND kc.chore_id = ?
        ");
        $stmt->execute([$kid['kid_user_id'], $choreId]);
        $kidChore = $stmt->fetch();
        
        if (!$kidChore) {
            jsonResponse(false, null, 'Chore not assigned to you');
        }
        
        $stmt = $db->prepare("
            SELECT id FROM submissions 
            WHERE kid_user_id = ? AND chore_id = ? AND status = 'pending'
        ");
        $stmt->execute([$kid['kid_user_id'], $choreId]);
        if ($stmt->fetch()) {
            jsonResponse(false, null, 'Submission already pending');
        }
        
        $status = $kidChore['requires_approval'] ? 'pending' : 'approved';
        $pointsAwarded = $kidChore['requires_approval'] ? 0 : $kidChore['default_points'];
        
        $stmt = $db->prepare("
            INSERT INTO submissions (kid_user_id, chore_id, status, note, points_awarded, reviewed_at) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $reviewedAt = $status === 'approved' ? date('Y-m-d H:i:s') : null;
        $stmt->execute([$kid['kid_user_id'], $choreId, $status, $note, $pointsAwarded, $reviewedAt]);
        $submissionId = $db->lastInsertId();
        
        if ($status === 'approved') {
            $stmt = $db->prepare("UPDATE users SET total_points = total_points + ? WHERE id = ?");
            $stmt->execute([$pointsAwarded, $kid['kid_user_id']]);
            
            if ($kidChore['is_recurring']) {
                $nextDue = calculateNextDue($kidChore['frequency']);
                $newStreak = $kidChore['streak_count'] + 1;
                
                $stmt = $db->prepare("
                    UPDATE kid_chores 
                    SET streak_count = ?, last_completed_at = datetime('now'), next_due_at = ?
                    WHERE kid_user_id = ? AND chore_id = ?
                ");
                $stmt->execute([$newStreak, $nextDue, $kid['kid_user_id'], $choreId]);
            }
        }
        
        logAudit($kid['kid_user_id'], 'submit_chore', ['chore_id' => $choreId, 'submission_id' => $submissionId]);
        jsonResponse(true, [
            'submission_id' => $submissionId,
            'status' => $status,
            'points_awarded' => $pointsAwarded
        ]);
        break;
    
    case 'list_submissions':
        requireAdmin();
        
        $status = $input['status'] ?? 'pending';
        if (!in_array($status, ['pending', 'approved', 'rejected'])) {
            $status = 'pending';
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            SELECT s.*, u.kid_name, c.title as chore_title
            FROM submissions s
            JOIN users u ON s.kid_user_id = u.id
            JOIN chores c ON s.chore_id = c.id
            WHERE s.status = ?
            ORDER BY s.submitted_at DESC
            LIMIT 100
        ");
        $stmt->execute([$status]);
        
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'review_submission':
        requireAdmin();
        
        $submissionId = intval($input['submission_id'] ?? 0);
        $status = $input['status'] ?? '';
        $pointsOverride = $input['points_override'] ?? null;
        $reviewNote = sanitize($input['note'] ?? '', 500);
        
        if (!$submissionId || !in_array($status, ['approved', 'rejected'])) {
            jsonResponse(false, null, 'Valid submission ID and status required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            SELECT s.*, c.default_points, c.is_recurring, c.frequency, kc.streak_count
            FROM submissions s
            JOIN chores c ON s.chore_id = c.id
            LEFT JOIN kid_chores kc ON s.kid_user_id = kc.kid_user_id AND s.chore_id = kc.chore_id
            WHERE s.id = ? AND s.status = 'pending'
        ");
        $stmt->execute([$submissionId]);
        $submission = $stmt->fetch();
        
        if (!$submission) {
            jsonResponse(false, null, 'Submission not found or already reviewed');
        }
        
        $pointsAwarded = $pointsOverride !== null ? intval($pointsOverride) : $submission['default_points'];
        
        $stmt = $db->prepare("
            UPDATE submissions 
            SET status = ?, points_awarded = ?, reviewed_at = datetime('now'), 
                reviewer_id = ?, note = CASE WHEN ? != '' THEN ? ELSE note END
            WHERE id = ?
        ");
        $stmt->execute([$status, $pointsAwarded, $_SESSION['admin_id'], $reviewNote, $reviewNote, $submissionId]);
        
        if ($status === 'approved') {
            $stmt = $db->prepare("UPDATE users SET total_points = total_points + ? WHERE id = ?");
            $stmt->execute([$pointsAwarded, $submission['kid_user_id']]);
            
            if ($submission['is_recurring']) {
                $nextDue = calculateNextDue($submission['frequency']);
                $newStreak = $submission['streak_count'] + 1;
                
                $stmt = $db->prepare("
                    UPDATE kid_chores 
                    SET streak_count = ?, last_completed_at = datetime('now'), next_due_at = ?
                    WHERE kid_user_id = ? AND chore_id = ?
                ");
                $stmt->execute([$newStreak, $nextDue, $submission['kid_user_id'], $submission['chore_id']]);
            }
        }
        
        logAudit($_SESSION['admin_id'], 'review_submission', [
            'submission_id' => $submissionId,
            'status' => $status,
            'points' => $pointsAwarded
        ]);
        
        jsonResponse(true, ['message' => 'Submission reviewed']);
        break;
    
    case 'create_quest':
        requireAdmin();
        
        $title = sanitize($input['title'] ?? '', 100);
        $description = sanitize($input['description'] ?? '', 2000);
        $targetReward = sanitize($input['target_reward'] ?? '', 200);
        
        if (!$title) {
            jsonResponse(false, null, 'Title is required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            INSERT INTO quests (title, description, target_reward, created_by) 
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$title, $description, $targetReward, $_SESSION['admin_id']]);
        $questId = $db->lastInsertId();
        
        logAudit($_SESSION['admin_id'], 'create_quest', ['quest_id' => $questId, 'title' => $title]);
        jsonResponse(true, ['id' => $questId]);
        break;
    
    case 'list_quests':
        $db = getDb();
        
        if (isset($_SESSION['admin_id'])) {
            $stmt = $db->query("
                SELECT q.*, COUNT(qt.id) as task_count
                FROM quests q
                LEFT JOIN quest_tasks qt ON q.id = qt.quest_id
                GROUP BY q.id
                ORDER BY q.is_active DESC, q.created_at DESC
            ");
        } else {
            $stmt = $db->query("
                SELECT q.*, COUNT(qt.id) as task_count
                FROM quests q
                LEFT JOIN quest_tasks qt ON q.id = qt.quest_id
                WHERE q.is_active = 1
                GROUP BY q.id
                ORDER BY q.created_at DESC
            ");
        }
        
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'toggle_quest':
        requireAdmin();
        
        $questId = intval($input['quest_id'] ?? 0);
        if (!$questId) {
            jsonResponse(false, null, 'Quest ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("UPDATE quests SET is_active = 1 - is_active WHERE id = ?");
        $stmt->execute([$questId]);
        
        logAudit($_SESSION['admin_id'], 'toggle_quest', ['quest_id' => $questId]);
        jsonResponse(true, ['message' => 'Quest toggled']);
        break;
    
    case 'create_quest_task':
        requireAdmin();
        
        $questId = intval($input['quest_id'] ?? 0);
        $title = sanitize($input['title'] ?? '', 100);
        $description = sanitize($input['description'] ?? '', 1000);
        $points = intval($input['points'] ?? 10);
        $orderIndex = intval($input['order_index'] ?? 0);
        
        if (!$questId || !$title) {
            jsonResponse(false, null, 'Quest ID and title required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            INSERT INTO quest_tasks (quest_id, title, description, points, order_index) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$questId, $title, $description, $points, $orderIndex]);
        $taskId = $db->lastInsertId();
        
        logAudit($_SESSION['admin_id'], 'create_quest_task', ['task_id' => $taskId, 'quest_id' => $questId]);
        jsonResponse(true, ['id' => $taskId]);
        break;
    
    case 'list_quest_tasks':
        $questId = intval($input['quest_id'] ?? 0);
        if (!$questId) {
            jsonResponse(false, null, 'Quest ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            SELECT * FROM quest_tasks 
            WHERE quest_id = ? 
            ORDER BY order_index, id
        ");
        $stmt->execute([$questId]);
        
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'delete_quest_task':
        requireAdmin();
        
        $taskId = intval($input['task_id'] ?? 0);
        if (!$taskId) {
            jsonResponse(false, null, 'Task ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("DELETE FROM quest_tasks WHERE id = ?");
        $stmt->execute([$taskId]);
        
        logAudit($_SESSION['admin_id'], 'delete_quest_task', ['task_id' => $taskId]);
        jsonResponse(true, ['message' => 'Task deleted']);
        break;
    
    case 'kid_submit_task':
        $kid = requireKid();
        
        $taskId = intval($input['task_id'] ?? 0);
        $note = sanitize($input['note'] ?? '', 500);
        
        if (!$taskId) {
            jsonResponse(false, null, 'Task ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            SELECT id FROM kid_quest_task_status 
            WHERE kid_user_id = ? AND quest_task_id = ?
        ");
        $stmt->execute([$kid['kid_user_id'], $taskId]);
        if ($stmt->fetch()) {
            jsonResponse(false, null, 'Task already submitted');
        }
        
        $stmt = $db->prepare("
            INSERT INTO kid_quest_task_status (kid_user_id, quest_task_id, note) 
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$kid['kid_user_id'], $taskId, $note]);
        
        logAudit($kid['kid_user_id'], 'submit_quest_task', ['task_id' => $taskId]);
        jsonResponse(true, ['message' => 'Task submitted']);
        break;
    
    case 'review_quest_task':
        requireAdmin();
        
        $statusId = intval($input['status_id'] ?? 0);
        $status = $input['status'] ?? '';
        
        if (!$statusId || !in_array($status, ['approved', 'rejected'])) {
            jsonResponse(false, null, 'Valid status ID and status required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            SELECT kqts.*, qt.points, qt.quest_id
            FROM kid_quest_task_status kqts
            JOIN quest_tasks qt ON kqts.quest_task_id = qt.id
            WHERE kqts.id = ? AND kqts.status = 'pending'
        ");
        $stmt->execute([$statusId]);
        $taskStatus = $stmt->fetch();
        
        if (!$taskStatus) {
            jsonResponse(false, null, 'Task status not found');
        }
        
        $stmt = $db->prepare("
            UPDATE kid_quest_task_status 
            SET status = ?, reviewed_at = datetime('now') 
            WHERE id = ?
        ");
        $stmt->execute([$status, $statusId]);
        
        if ($status === 'approved') {
            $stmt = $db->prepare("
                INSERT INTO kid_quest_progress (kid_user_id, quest_id, total_points) 
                VALUES (?, ?, ?)
                ON CONFLICT(kid_user_id, quest_id) 
                DO UPDATE SET total_points = total_points + ?
            ");
            $stmt->execute([
                $taskStatus['kid_user_id'],
                $taskStatus['quest_id'],
                $taskStatus['points'],
                $taskStatus['points']
            ]);
        }
        
        logAudit($_SESSION['admin_id'], 'review_quest_task', ['status_id' => $statusId, 'status' => $status]);
        jsonResponse(true, ['message' => 'Task reviewed']);
        break;
    
    case 'kid_quest_progress':
        $kid = requireKid();
        
        $db = getDb();
        $stmt = $db->prepare("
            SELECT q.id, q.title, q.description, q.target_reward,
                   COALESCE(kqp.total_points, 0) as earned_points,
                   (SELECT SUM(points) FROM quest_tasks WHERE quest_id = q.id) as total_points,
                   (SELECT COUNT(*) FROM quest_tasks WHERE quest_id = q.id) as total_tasks,
                   (SELECT COUNT(*) 
                    FROM kid_quest_task_status kqts 
                    JOIN quest_tasks qt ON kqts.quest_task_id = qt.id 
                    WHERE qt.quest_id = q.id AND kqts.kid_user_id = ? AND kqts.status = 'approved'
                   ) as completed_tasks
            FROM quests q
            LEFT JOIN kid_quest_progress kqp ON q.id = kqp.quest_id AND kqp.kid_user_id = ?
            WHERE q.is_active = 1
            ORDER BY q.id
        ");
        $stmt->execute([$kid['kid_user_id'], $kid['kid_user_id']]);
        
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'create_reward':
        $admin = requireAdmin();
    
        $title = sanitize($input['title'] ?? '', 100);
        $description = sanitize($input['description'] ?? '', 1000);
        $costPoints = intval($input['cost_points'] ?? 50);
    
        if (!$title) {
            jsonResponse(false, null, 'Title is required');
        }
    
        $db = getDb();
        $stmt = $db->prepare("
            INSERT INTO rewards (title, description, cost_points, created_by) 
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$title, $description, $costPoints, $admin['user_id']]);
        $rewardId = $db->lastInsertId();
    
        logAudit($admin['user_id'], 'create_reward', ['reward_id' => $rewardId]);
        jsonResponse(true, ['id' => $rewardId]);
        break;
    
    case 'list_rewards':
        $db = getDb();
    
        if (isset($_SESSION['admin_id'])) {
            $stmt = $db->query("
                SELECT r.*, 
                       COALESCE(r.available, 1) as available,
                       COALESCE(r.created_by, 1) as created_by
                FROM rewards r 
                ORDER BY r.available DESC, r.cost_points
            ");
        } else {
            $stmt = $db->query("
                SELECT r.*,
                    COALESCE(r.available, 1) as available
                FROM rewards r 
                WHERE COALESCE(r.available, 1) = 1 
                ORDER BY r.cost_points
            ");
        }
    
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'toggle_reward':
        requireAdmin();
        
        $rewardId = intval($input['reward_id'] ?? 0);
        if (!$rewardId) {
            jsonResponse(false, null, 'Reward ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("UPDATE rewards SET is_active = 1 - is_active WHERE id = ?");
        $stmt->execute([$rewardId]);
        
        logAudit($_SESSION['admin_id'], 'toggle_reward', ['reward_id' => $rewardId]);
        jsonResponse(true, ['message' => 'Reward toggled']);
        break;
    
    case 'kid_redeem_reward':
        $kid = requireKid();
        
        $rewardId = intval($input['reward_id'] ?? 0);
        if (!$rewardId) {
            jsonResponse(false, null, 'Reward ID required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("SELECT * FROM rewards WHERE id = ? AND is_active = 1");
        $stmt->execute([$rewardId]);
        $reward = $stmt->fetch();
        
        if (!$reward) {
            jsonResponse(false, null, 'Reward not found or inactive');
        }
        
        if ($kid['total_points'] < $reward['cost_points']) {
            jsonResponse(false, null, 'Not enough points');
        }
        
        $stmt = $db->prepare("
            INSERT INTO redemptions (kid_user_id, reward_id) 
            VALUES (?, ?)
        ");
        $stmt->execute([$kid['kid_user_id'], $rewardId]);
        
        logAudit($kid['kid_user_id'], 'redeem_reward', ['reward_id' => $rewardId]);
        jsonResponse(true, ['message' => 'Redemption requested']);
        break;
    
    case 'list_redemptions':
        requireAdmin();
        
        $status = $input['status'] ?? 'pending';
        if (!in_array($status, ['pending', 'approved', 'rejected'])) {
            $status = 'pending';
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            SELECT r.*, u.kid_name, rw.title as reward_title, rw.cost_points
            FROM redemptions r
            JOIN users u ON r.kid_user_id = u.id
            JOIN rewards rw ON r.reward_id = rw.id
            WHERE r.status = ?
            ORDER BY r.requested_at DESC
        ");
        $stmt->execute([$status]);
        
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'review_redemption':
        requireAdmin();
        
        $redemptionId = intval($input['redemption_id'] ?? 0);
        $status = $input['status'] ?? '';
        
        if (!$redemptionId || !in_array($status, ['approved', 'rejected'])) {
            jsonResponse(false, null, 'Valid redemption ID and status required');
        }
        
        $db = getDb();
        $stmt = $db->prepare("
            SELECT r.*, rw.cost_points, u.total_points
            FROM redemptions r
            JOIN rewards rw ON r.reward_id = rw.id
            JOIN users u ON r.kid_user_id = u.id
            WHERE r.id = ? AND r.status = 'pending'
        ");
        $stmt->execute([$redemptionId]);
        $redemption = $stmt->fetch();
        
        if (!$redemption) {
            jsonResponse(false, null, 'Redemption not found');
        }
        
        $stmt = $db->prepare("
            UPDATE redemptions 
            SET status = ?, resolved_at = datetime('now'), resolver_id = ? 
            WHERE id = ?
        ");
        $stmt->execute([$status, $_SESSION['admin_id'], $redemptionId]);
        
        if ($status === 'approved') {
            $stmt = $db->prepare("UPDATE users SET total_points = total_points - ? WHERE id = ?");
            $stmt->execute([$redemption['cost_points'], $redemption['kid_user_id']]);
        }
        
        logAudit($_SESSION['admin_id'], 'review_redemption', ['redemption_id' => $redemptionId, 'status' => $status]);
        jsonResponse(true, ['message' => 'Redemption reviewed']);
        break;
    
    case 'kid_feed':
    $kid = requireKid();
    
    $db = getDb();
    $stmt = $db->prepare("
        SELECT kc.*, c.title, c.description, c.default_points, c.requires_approval,
               CASE WHEN datetime(kc.next_due_at) <= datetime('now') THEN 1 ELSE 0 END as is_due
        FROM kid_chores kc
        JOIN chores c ON kc.chore_id = c.id
        WHERE kc.kid_user_id = ?
        ORDER BY is_due DESC, kc.next_due_at
    ");
    $stmt->execute([$kid['kid_user_id']]);
    $chores = $stmt->fetchAll();
    
    $stmt = $db->prepare("
        SELECT s.*, c.title as chore_title
        FROM submissions s
        JOIN chores c ON s.chore_id = c.id
        WHERE s.kid_user_id = ?
        ORDER BY s.submitted_at DESC
        LIMIT 10
    ");
    $stmt->execute([$kid['kid_user_id']]);
    $submissions = $stmt->fetchAll();
    
    $stmt = $db->prepare("
        SELECT q.id, q.title, q.target_reward,
               COALESCE(kqp.total_points, 0) as earned_points,
               (SELECT SUM(points) FROM quest_tasks WHERE quest_id = q.id) as total_points
        FROM quests q
        LEFT JOIN kid_quest_progress kqp ON q.id = kqp.quest_id AND kqp.kid_user_id = ?
        WHERE q.is_active = 1
    ");
    $stmt->execute([$kid['kid_user_id']]);
    $quests = $stmt->fetchAll();
    
    // NEW: Add redemptions to the feed
    $stmt = $db->prepare("
        SELECT r.*, rw.title as reward_title, rw.cost_points
        FROM redemptions r
        JOIN rewards rw ON r.reward_id = rw.id
        WHERE r.kid_user_id = ?
        ORDER BY r.requested_at DESC
        LIMIT 10
    ");
    $stmt->execute([$kid['kid_user_id']]);
    $redemptions = $stmt->fetchAll();
    
    jsonResponse(true, [
        'kid_name' => $kid['kid_name'],
        'total_points' => $kid['total_points'],
        'chores' => $chores,
        'submissions' => $submissions,
        'quests' => $quests,
        'redemptions' => $redemptions  // NEW LINE
    ]);
    break;
    
    case 'stats_overview':
        requireAdmin();
        
        $db = getDb();
        
        $pendingSubmissions = $db->query("SELECT COUNT(*) as count FROM submissions WHERE status = 'pending'")->fetch()['count'];
        $pendingRedemptions = $db->query("SELECT COUNT(*) as count FROM redemptions WHERE status = 'pending'")->fetch()['count'];
        $pendingQuests = $db->query("SELECT COUNT(*) as count FROM kid_quest_task_status WHERE status = 'pending'")->fetch()['count'];
        
        $todayCompletions = $db->query("
            SELECT COUNT(*) as count FROM submissions 
            WHERE DATE(submitted_at) = DATE('now')
        ")->fetch()['count'];
        
        $streakLeaders = $db->query("
            SELECT u.kid_name, c.title as chore_title, kc.streak_count
            FROM kid_chores kc
            JOIN users u ON kc.kid_user_id = u.id
            JOIN chores c ON kc.chore_id = c.id
            WHERE kc.streak_count > 0
            ORDER BY kc.streak_count DESC
            LIMIT 5
        ")->fetchAll();
        
        $pointsLeaders = $db->query("
            SELECT kid_name, total_points
            FROM users
            WHERE role = 'kid'
            ORDER BY total_points DESC
            LIMIT 5
        ")->fetchAll();
        
        jsonResponse(true, [
            'pending_submissions' => $pendingSubmissions,
            'pending_redemptions' => $pendingRedemptions,
            'pending_quest_tasks' => $pendingQuests,
            'today_completions' => $todayCompletions,
            'streak_leaders' => $streakLeaders,
            'points_leaders' => $pointsLeaders
        ]);
        break;
    
    case 'list_admins':
        requireAdmin();
        
        $db = getDb();
        $stmt = $db->query("
            SELECT id, email, kid_name as name, created_at 
            FROM users 
            WHERE role = 'admin' 
            ORDER BY created_at DESC
        ");
        
        jsonResponse(true, $stmt->fetchAll());
        break;
    
    case 'create_admin':
        requireAdmin();
        
        $email = sanitize($input['email'] ?? '', 100);
        $password = $input['password'] ?? '';
        $name = sanitize($input['name'] ?? '', 100);
        
        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(false, null, 'Valid email required');
        }
        
        if (strlen($password) < 8) {
            jsonResponse(false, null, 'Password must be at least 8 characters');
        }
        
        $db = getDb();
        
        // Check if email exists
        $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            jsonResponse(false, null, 'Email already exists');
        }
        
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare("INSERT INTO users (role, email, password_hash, kid_name) VALUES ('admin', ?, ?, ?)");
        $stmt->execute([$email, $hash, $name]);
        $adminId = $db->lastInsertId();
        
        logAudit($_SESSION['admin_id'], 'create_admin', ['new_admin_id' => $adminId, 'email' => $email]);
        jsonResponse(true, ['id' => $adminId, 'email' => $email]);
        break;
    
    case 'delete_admin':
        requireAdmin();
        
        $adminId = intval($input['admin_id'] ?? 0);
        
        if ($adminId === $_SESSION['admin_id']) {
            jsonResponse(false, null, 'Cannot delete yourself');
        }
        
        $db = getDb();
        
        // Prevent deleting last admin
        $stmt = $db->query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
        if ($stmt->fetch()['count'] <= 1) {
            jsonResponse(false, null, 'Cannot delete the last admin');
        }
        
        $stmt = $db->prepare("DELETE FROM users WHERE id = ? AND role = 'admin'");
        $stmt->execute([$adminId]);
        
        logAudit($_SESSION['admin_id'], 'delete_admin', ['deleted_admin_id' => $adminId]);
        jsonResponse(true, ['message' => 'Admin deleted']);
        break;
    
    case 'upload_kid_avatar':
        $kid = requireKid();
    
        $photoData = $input['photo_data'] ?? '';
    
        if (!$photoData) {
            jsonResponse(false, null, 'Photo data required');
        }
    
        // Validate base64 image
        if (!preg_match('/^data:image\/(jpeg|jpg|png);base64,/', $photoData)) {
            jsonResponse(false, null, 'Invalid image format');
        }
    
        // Check size (limit to 500KB encoded)
        if (strlen($photoData) > 500000) {
            jsonResponse(false, null, 'Image too large');
        }
    
        $db = getDb();
        $stmt = $db->prepare("UPDATE users SET avatar_photo = ? WHERE id = ?");
        $stmt->execute([$photoData, $kid['kid_user_id']]);
    
        logAudit($kid['kid_user_id'], 'avatar_uploaded', []);
        jsonResponse(true, ['message' => 'Avatar saved']);
        break;

    case 'get_kid_avatar':
        $kid = requireKid();
    
        $db = getDb();
        $stmt = $db->prepare("SELECT avatar_photo FROM users WHERE id = ?");
        $stmt->execute([$kid['kid_user_id']]);
        $user = $stmt->fetch();
    
        jsonResponse(true, ['photo_data' => $user['avatar_photo'] ?? null]);
        break;
    
    case 'save_kid_settings':
        $kid_id = $_SESSION['kid_id'] ?? null;
        $settings = $data['settings'] ?? null;
        
        if (!$kid_id || !$settings) {
            echo json_encode(['ok' => false, 'error' => 'Missing data']);
            break;
        }
        
        // Store settings as JSON
        $settings_json = json_encode($settings);
        
        $stmt = $conn->prepare("UPDATE kids SET settings = ? WHERE id = ?");
        $stmt->bind_param("si", $settings_json, $kid_id);
        
        if ($stmt->execute()) {
            echo json_encode(['ok' => true]);
        } else {
            echo json_encode(['ok' => false, 'error' => 'Failed to save settings']);
        }
        break;
    
    case 'load_kid_settings':
        $kid_id = $_SESSION['kid_id'] ?? null;
        
        if (!$kid_id) {
            echo json_encode(['ok' => false, 'error' => 'Not logged in']);
            break;
        }
        
        $stmt = $conn->prepare("SELECT settings FROM kids WHERE id = ?");
        $stmt->bind_param("i", $kid_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $kid = $result->fetch_assoc();
        
        if ($kid && $kid['settings']) {
            $settings = json_decode($kid['settings'], true);
            echo json_encode(['ok' => true, 'settings' => $settings]);
        } else {
            echo json_encode(['ok' => true, 'settings' => []]);
        }
        break;
        
    case 'load_chore_presets':
        requireAdmin();
        
        $presetsFile = __DIR__ . '/../chore-presets.json';
        
        if (!file_exists($presetsFile)) {
            jsonResponse(false, null, 'Presets file not found');
        }
        
        $presets = json_decode(file_get_contents($presetsFile), true);
        jsonResponse(true, $presets);
        break;

    case 'install_preset_category':
        $admin = requireAdmin();
        
        $category = $input['category'] ?? '';
        $chores = $input['chores'] ?? [];
        $kidId = $input['kid_id'] ?? null;
        
        if (empty($chores)) {
            jsonResponse(false, null, 'No chores provided');
        }
        
        $db = getDb();
        $installed = 0;
        
        // Include scheduler
        require_once __DIR__ . '/scheduler.php';
        
        foreach ($chores as $chore) {
            $startDate = $chore['start_date'] === 'today' ? date('Y-m-d') : $chore['start_date'];
            
            $stmt = $db->prepare("
                INSERT INTO chores (
                    title, description, default_points, requires_approval,
                    recurrence_type, recurrence_value, start_date,
                    assigned_kid_id, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $chore['title'],
                $chore['description'] ?? '',
                $chore['default_points'],
                $chore['requires_approval'] ?? 1,
                $chore['recurrence_type'],
                $chore['recurrence_value'] ?? null,
                $startDate,
                $kidId,
                $admin['user_id']
            ]);
            
            $choreId = $db->lastInsertId();
            generateScheduleForChore($choreId);
            $installed++;
        }
        
        logAudit($admin['user_id'], 'presets_installed', [
            'category' => $category,
            'count' => $installed
        ]);
        
        jsonResponse(true, ['installed' => $installed]);
        break;

    case 'install_preset_rewards':
        $admin = requireAdmin();
        
        $rewards = $input['rewards'] ?? [];
        
        if (empty($rewards)) {
            jsonResponse(false, null, 'No rewards provided');
        }
        
        $db = getDb();
        $installed = 0;
        
        foreach ($rewards as $reward) {
            $stmt = $db->prepare("
                INSERT INTO rewards (title, description, cost_points, created_by)
                VALUES (?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $reward['title'],
                $reward['description'] ?? '',
                $reward['cost_points'],
                $admin['user_id']
            ]);
            
            $installed++;
        }
        
        logAudit($admin['user_id'], 'preset_rewards_installed', [
            'count' => $installed
        ]);
        
        jsonResponse(true, ['installed' => $installed]);
        break;
    case 'upload_avatar_photo':
    $kid = requireKid();
    
    $photoData = $input['photo_data'] ?? '';
    
    if (!$photoData) {
        jsonResponse(false, null, 'Photo data required');
    }
    
    // Validate base64 image
    if (!preg_match('/^data:image\/(jpeg|jpg|png);base64,/', $photoData)) {
        jsonResponse(false, null, 'Invalid image format');
    }
    
    // Check size (limit to 500KB encoded)
    if (strlen($photoData) > 500000) {
        jsonResponse(false, null, 'Image too large');
    }
    
    // Get kid's name for filename
    $db = getDb();
    $stmt = $db->prepare("SELECT kid_name FROM users WHERE id = ?");
    $stmt->execute([$kid['kid_user_id']]);
    $kidData = $stmt->fetch();
    
    if (!$kidData) {
        jsonResponse(false, null, 'Kid not found');
    }
    
    // Sanitize name for filename
    $safeName = preg_replace('/[^a-z0-9]/i', '', strtolower($kidData['kid_name']));
    
    // Create avatars directory if it doesn't exist
    $avatarDir = __DIR__ . '/../assets/avatars/users';
    if (!file_exists($avatarDir)) {
        mkdir($avatarDir, 0755, true);
    }
    
    // Find next available slot (limit 3 per user)
    $existingCount = 0;
    for ($i = 1; $i <= 3; $i++) {
        if (file_exists("$avatarDir/{$safeName}_{$i}.png")) {
            $existingCount++;
        }
    }
    
    if ($existingCount >= 3) {
        jsonResponse(false, null, 'Maximum 3 photos per user. Delete one first.');
    }
    
    // Find next slot number
    $slotNumber = 1;
    for ($i = 1; $i <= 3; $i++) {
        if (!file_exists("$avatarDir/{$safeName}_{$i}.png")) {
            $slotNumber = $i;
            break;
        }
    }
    
    // Decode and save image
    $imageData = explode(',', $photoData)[1];
    $decodedImage = base64_decode($imageData);
    
    $filename = "{$safeName}_{$slotNumber}.png";
    $filepath = "$avatarDir/$filename";
    
    if (file_put_contents($filepath, $decodedImage)) {
        logAudit($kid['kid_user_id'], 'avatar_uploaded', ['filename' => $filename]);
        jsonResponse(true, [
            'filename' => $filename,
            'url' => "/assets/avatars/users/$filename"
        ]);
    } else {
        jsonResponse(false, null, 'Failed to save image');
    }
    break;

case 'list_avatars':
    $kid = requireKid();
    
    // Get default avatars
    $defaultDir = __DIR__ . '/../assets/avatars/default';
    $defaultAvatars = [];
    
    if (file_exists($defaultDir)) {
        $files = scandir($defaultDir);
        foreach ($files as $file) {
            if (preg_match('/^avatar_\d+\.(png|jpg|jpeg)$/i', $file)) {
                $defaultAvatars[] = [
                    'type' => 'default',
                    'filename' => $file,
                    'url' => "/assets/avatars/default/$file"
                ];
            }
        }
        // Sort naturally
        usort($defaultAvatars, function($a, $b) {
            return strnatcmp($a['filename'], $b['filename']);
        });
    }
    
    // Get user's custom avatars
    $db = getDb();
    $stmt = $db->prepare("SELECT kid_name FROM users WHERE id = ?");
    $stmt->execute([$kid['kid_user_id']]);
    $kidData = $stmt->fetch();
    
    $userAvatars = [];
    if ($kidData) {
        $safeName = preg_replace('/[^a-z0-9]/i', '', strtolower($kidData['kid_name']));
        $userDir = __DIR__ . '/../assets/avatars/users';
        
        if (file_exists($userDir)) {
            for ($i = 1; $i <= 3; $i++) {
                $filename = "{$safeName}_{$i}.png";
                if (file_exists("$userDir/$filename")) {
                    $userAvatars[] = [
                        'type' => 'user',
                        'filename' => $filename,
                        'url' => "/assets/avatars/users/$filename",
                        'slot' => $i
                    ];
                }
            }
        }
    }
    
    jsonResponse(true, [
        'default' => $defaultAvatars,
        'user' => $userAvatars,
        'canUploadMore' => count($userAvatars) < 3
    ]);
    break;

case 'delete_user_avatar':
    $kid = requireKid();
    
    $filename = $input['filename'] ?? '';
    
    if (!$filename) {
        jsonResponse(false, null, 'Filename required');
    }
    
    // Security: verify it belongs to this user
    $db = getDb();
    $stmt = $db->prepare("SELECT kid_name FROM users WHERE id = ?");
    $stmt->execute([$kid['kid_user_id']]);
    $kidData = $stmt->fetch();
    
    if (!$kidData) {
        jsonResponse(false, null, 'Kid not found');
    }
    
    $safeName = preg_replace('/[^a-z0-9]/i', '', strtolower($kidData['kid_name']));
    
    // Verify filename matches user
    if (!preg_match("/^{$safeName}_[1-3]\.png$/", $filename)) {
        jsonResponse(false, null, 'Unauthorized');
    }
    
    $filepath = __DIR__ . "/../assets/avatars/users/$filename";
    
    if (file_exists($filepath)) {
        unlink($filepath);
        logAudit($kid['kid_user_id'], 'avatar_deleted', ['filename' => $filename]);
        jsonResponse(true, ['message' => 'Avatar deleted']);
    } else {
        jsonResponse(false, null, 'File not found');
    }
    break;
      
        default:
        jsonResponse(false, null, 'Invalid action');
}
?>