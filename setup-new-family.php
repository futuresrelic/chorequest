<?php
// Put this file INSIDE tasks.futuresrelic.com folder

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $familyName = preg_replace('/[^a-z0-9-]/', '', strtolower($_POST['family_name'] ?? ''));
    
    if (!$familyName) {
        die('Invalid family name');
    }
    
    $targetDir = __DIR__ . '/' . $familyName;
    
    if (file_exists($targetDir)) {
        die('❌ Family folder already exists! <br><a href="/setup-new-family.php">Try Again</a>');
    }
    
    try {
        // Create target directory
        mkdir($targetDir, 0755, true);
        
        // Explicitly list what to copy
        $foldersToCreate = [
            'admin',
            'api', 
            'assets',
            'config',
            'kid',
            'data'
        ];
        
        foreach ($foldersToCreate as $folder) {
            $source = __DIR__ . '/' . $folder;
            $dest = $targetDir . '/' . $folder;
            
            if ($folder === 'data') {
                // Just create empty data folder
                mkdir($dest, 0755, true);
            } elseif (is_dir($source)) {
                copyFolder($source, $dest);
            }
        }
        
        // Initialize database with schema and admin user
$dbPath = $targetDir . '/data/database.sqlite';
$db = new PDO('sqlite:' . $dbPath);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Create all tables
$schema = "
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'kid')),
    total_points INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    default_points INTEGER NOT NULL,
    requires_approval INTEGER DEFAULT 1,
    recurrence_type TEXT NOT NULL CHECK(recurrence_type IN ('once', 'daily', 'weekly', 'monthly')),
    recurrence_value TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    assigned_kid_id INTEGER,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_kid_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS chore_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chore_id INTEGER NOT NULL,
    due_at DATETIME NOT NULL,
    FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chore_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chore_id INTEGER NOT NULL,
    kid_id INTEGER NOT NULL,
    note TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    points_awarded INTEGER,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewed_by INTEGER,
    FOREIGN KEY (chore_id) REFERENCES chores(id),
    FOREIGN KEY (kid_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    target_reward TEXT,
    assigned_kid_id INTEGER,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_kid_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS quest_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quest_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    points INTEGER NOT NULL,
    order_num INTEGER DEFAULT 0,
    FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quest_task_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    kid_id INTEGER NOT NULL,
    note TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    points_awarded INTEGER,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewed_by INTEGER,
    FOREIGN KEY (task_id) REFERENCES quest_tasks(id),
    FOREIGN KEY (kid_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    cost_points INTEGER NOT NULL,
    available INTEGER DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reward_id INTEGER NOT NULL,
    kid_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    fulfilled_at DATETIME,
    fulfilled_by INTEGER,
    FOREIGN KEY (reward_id) REFERENCES rewards(id),
    FOREIGN KEY (kid_id) REFERENCES users(id),
    FOREIGN KEY (fulfilled_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS paired_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id INTEGER NOT NULL,
    device_token TEXT UNIQUE NOT NULL,
    device_label TEXT,
    paired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kid_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
";

$db->exec($schema);

// Create default admin user
$hashedPassword = password_hash('changeme', PASSWORD_DEFAULT);
$stmt = $db->prepare("INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)");
$stmt->execute(['admin@example.com', $hashedPassword, 'admin', 'Admin']);
        
        echo "<h1>✅ New Family Created Successfully!</h1>";
        echo "<div style='background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0;'>";
        echo "<p><strong>📁 Folder:</strong> /$familyName/</p>";
        echo "<p><strong>👨‍💼 Admin Panel:</strong> <a href='/$familyName/admin/' target='_blank'>https://tasks.futuresrelic.com/$familyName/admin/</a></p>";
        echo "<p><strong>👧 Kid Panel:</strong> <a href='/$familyName/kid/' target='_blank'>https://tasks.futuresrelic.com/$familyName/kid/</a></p>";
        echo "</div>";
        
        echo "<div style='background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;'>";
        echo "<h3>🔐 Login Credentials:</h3>";
        echo "<p><strong>Email:</strong> admin@example.com</p>";
        echo "<p><strong>Password:</strong> changeme</p>";
        echo "<p style='color: red; font-weight: bold;'>⚠️ CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!</p>";
        echo "</div>";
        
        echo "<div style='margin-top: 30px;'>";
        echo "<a href='/$familyName/admin/' style='display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin-right: 10px; font-weight: 600;'>→ Login to New Family</a>";
        echo "<a href='/setup-new-family.php' style='display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin-right: 10px;'>+ Create Another</a>";
        echo "<a href='/admin/' style='display: inline-block; padding: 12px 24px; background: #6b7280; color: white; text-decoration: none; border-radius: 8px;'>← Main Admin</a>";
        echo "</div>";
        
    } catch (Exception $e) {
        echo "<h1>❌ Error</h1>";
        echo "<p>" . $e->getMessage() . "</p>";
        echo "<pre>" . $e->getTraceAsString() . "</pre>";
        echo "<br><a href='/setup-new-family.php'>Try Again</a>";
    }
    
    exit;
}

function copyFolder($src, $dst) {
    if (!is_dir($dst)) {
        mkdir($dst, 0755, true);
    }
    
    $dir = opendir($src);
    if (!$dir) {
        throw new Exception("Cannot open directory: $src");
    }
    
    while (($file = readdir($dir)) !== false) {
        if ($file === '.' || $file === '..') {
            continue;
        }
        
        $srcPath = $src . '/' . $file;
        $dstPath = $dst . '/' . $file;
        
        if (is_dir($srcPath)) {
            copyFolder($srcPath, $dstPath);
        } else {
            if (!copy($srcPath, $dstPath)) {
                throw new Exception("Failed to copy: $srcPath");
            }
        }
    }
    
    closedir($dir);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create New Family</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            max-width: 700px;
            margin: 50px auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #1f2937;
            margin-bottom: 10px;
            font-size: 32px;
        }
        p {
            color: #6b7280;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        input {
            width: 100%;
            padding: 14px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 16px;
            margin-bottom: 10px;
        }
        input:focus {
            outline: none;
            border-color: #4f46e5;
        }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
        }
        .info-box {
            background: #f0f9ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .info-box h3 {
            margin: 0 0 10px 0;
            color: #1e40af;
        }
        .info-box ul {
            margin: 0;
            padding-left: 20px;
            color: #1e40af;
        }
        .warning-box {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            color: #92400e;
        }
        .hint {
            font-size: 13px;
            color: #9ca3af;
            margin-top: -10px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏠 Create New Family</h1>
        <p>Set up a completely separate installation for another family. Each family will have their own isolated database and users.</p>
        
        <div class="info-box">
            <h3>What gets created:</h3>
            <ul>
                <li>New folder: <strong>/your-family-name/</strong></li>
                <li>Complete copy of admin and kid panels</li>
                <li>Fresh, empty database</li>
                <li>Independent from all other families</li>
            </ul>
        </div>
        
        <div class="warning-box">
            <strong>⚠️ Important:</strong> The new family will need to:
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Change the default admin password</li>
                <li>Add their own kids</li>
                <li>Create their own chores and rewards</li>
            </ul>
        </div>
        
        <form method="POST">
            <label for="family_name" style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Family Folder Name:</label>
            <input 
                type="text" 
                id="family_name" 
                name="family_name" 
                placeholder="jones-family" 
                pattern="[a-z0-9-]+"
                required
            >
            <div class="hint">
                ✓ Use lowercase letters, numbers, and hyphens<br>
                ✗ No spaces, underscores, or special characters
            </div>
            
            <button type="submit">🚀 Create Family Installation</button>
        </form>
        
        <p style="margin-top: 30px; text-align: center; font-size: 14px; color: #9ca3af;">
            Examples: <code style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px;">jones-family</code> 
            <code style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px;">smith-chores</code> 
            <code style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px;">williams</code>
        </p>
    </div>
</body>
</html>