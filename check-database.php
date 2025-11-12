<?php
// Database diagnostic - DELETE after use!

$dbPath = __DIR__ . '/data/app.sqlite';

try {
    echo "<h2>Database Diagnostics</h2>";
    
    // Check if database exists
    if (!file_exists($dbPath)) {
        echo "❌ Database file doesn't exist!<br>";
        echo "Expected at: " . $dbPath . "<br>";
        echo "<strong>The database was deleted or never created.</strong><br><br>";
        
        echo "<form method='post'>";
        echo "<button type='submit' name='recreate' style='padding: 15px 30px; background: #4F46E5; color: white; border: none; border-radius: 8px; cursor: pointer;'>Recreate Database</button>";
        echo "</form>";
        
        if (isset($_POST['recreate'])) {
            require_once __DIR__ . '/config/config.php';
            echo "<br>✅ Database recreated!<br>";
            echo "<a href='check-database.php'>Refresh this page</a>";
        }
        die();
    }
    
    echo "✅ Database file exists<br>";
    echo "Size: " . filesize($dbPath) . " bytes<br>";
    echo "Last modified: " . date('Y-m-d H:i:s', filemtime($dbPath)) . "<br><br>";
    
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Check tables
    echo "<h3>Tables:</h3>";
    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
    echo "Found " . count($tables) . " tables<br>";
    
    // Check users
    echo "<h3>Users:</h3>";
    $stmt = $db->query("SELECT id, email, role, kid_name FROM users");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Total users: " . count($users) . "<br><br>";
    
    foreach ($users as $user) {
        echo "ID: {$user['id']}, Role: {$user['role']}, ";
        if ($user['role'] === 'admin') {
            echo "Email: {$user['email']}";
        } else {
            echo "Name: {$user['kid_name']}";
        }
        echo "<br>";
    }
    
    // Check chores
    echo "<h3>Chores:</h3>";
    $stmt = $db->query("SELECT COUNT(*) as count FROM chores");
    $choreCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    echo "Total chores: " . $choreCount . "<br>";
    
    if ($choreCount > 0) {
        $stmt = $db->query("SELECT id, title FROM chores LIMIT 5");
        while ($chore = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "- {$chore['title']}<br>";
        }
    }
    
    // Check kid_chores
    echo "<h3>Assigned Chores:</h3>";
    $stmt = $db->query("SELECT COUNT(*) as count FROM kid_chores");
    $assignedCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    echo "Total assigned chores: " . $assignedCount . "<br>";
    
    // Check devices
    echo "<h3>Devices:</h3>";
    $stmt = $db->query("SELECT COUNT(*) as paired FROM devices WHERE paired_at IS NOT NULL");
    $pairedCount = $stmt->fetch(PDO::FETCH_ASSOC)['paired'];
    $stmt = $db->query("SELECT COUNT(*) as unpaired FROM devices WHERE paired_at IS NULL");
    $unpairedCount = $stmt->fetch(PDO::FETCH_ASSOC)['unpaired'];
    echo "Paired devices: " . $pairedCount . "<br>";
    echo "Unpaired codes: " . $unpairedCount . "<br>";
    
    // Summary
    echo "<hr>";
    echo "<h3>Summary:</h3>";
    
    if (count($users) === 0) {
        echo "❌ <strong>Database is empty!</strong><br>";
        echo "The database was recreated or wiped.<br><br>";
        echo "<form method='post'>";
        echo "<button type='submit' name='reseed' style='padding: 15px 30px; background: #10B981; color: white; border: none; border-radius: 8px; cursor: pointer;'>Add Seed Data (Admin + Sample Chores)</button>";
        echo "</form>";
        
        if (isset($_POST['reseed'])) {
            // Add admin
            $adminHash = password_hash('changeme', PASSWORD_DEFAULT);
            $db->exec("INSERT INTO users (email, password_hash, role) VALUES ('admin@example.com', '$adminHash', 'admin')");
            
            // Add sample kid
            $db->exec("INSERT INTO users (role, kid_name, total_points) VALUES ('kid', 'Alex', 0)");
            
            // Add sample chores
            $db->exec("INSERT INTO chores (title, description, is_recurring, frequency, default_points, requires_approval, created_by) VALUES 
                ('Make Bed', 'Make your bed neatly every morning', 1, 'daily', 5, 0, 1),
                ('Clean Room', 'Clean and organize your entire room', 1, 'weekly', 20, 1, 1),
                ('Do Homework', 'Complete all homework assignments', 1, 'daily', 10, 1, 1)
            ");
            
            // Add sample quest
            $db->exec("INSERT INTO quests (title, description, target_reward, created_by, is_active) VALUES
                ('Waterpark Trip', 'Complete all tasks to earn a trip to the waterpark!', 'Family waterpark visit', 1, 1)
            ");
            
            $questId = $db->lastInsertId();
            
            $db->exec("INSERT INTO quest_tasks (quest_id, title, description, points, order_index) VALUES
                ($questId, 'One Week Perfect Attendance', 'Make your bed every day for a week', 30, 1),
                ($questId, 'Help with Dishes', 'Help with dishes 5 times', 20, 2),
                ($questId, 'Read 3 Books', 'Read and report on 3 books', 50, 3)
            ");
            
            // Add sample rewards
            $db->exec("INSERT INTO rewards (title, description, cost_points, is_active) VALUES
                ('1 Hour Phone Time', 'Get 1 extra hour of phone/tablet time', 50, 1),
                ('Choose Dinner', 'Pick what we have for dinner', 30, 1),
                ('Movie Night', 'Family movie night with your choice', 75, 1)
            ");
            
            echo "<br>✅ Seed data added!<br>";
            echo "<a href='check-database.php'>Refresh</a> | <a href='admin/'>Go to Admin Panel</a>";
        }
    } else {
        echo "✅ Database looks OK<br>";
        echo "<a href='admin/'>Go to Admin Panel</a> | <a href='fix-app.php'>Clear Rate Limits & Get Pairing Code</a>";
    }
    
    echo "<br><br><strong style='color: red;'>⚠️ DELETE check-database.php after use!</strong>";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage();
}
?>