<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/api/scheduler.php';

echo "<h1>Testing API Install Preset Call</h1>";

// Start session (API needs this)
startSession();

// Simulate being logged in as admin
$_SESSION['user_id'] = 1;
$_SESSION['user_role'] = 'admin';

// Load presets
$presetsFile = __DIR__ . '/chore-presets.json';
$presets = json_decode(file_get_contents($presetsFile), true);

echo "<h2>Testing Morning Routine Installation</h2>";

try {
    $db = getDb();
    
    $category = 'morning_routine';
    $chores = $presets[$category];
    $kidId = null; // Unassigned
    
    echo "<p>Installing " . count($chores) . " chores...</p>";
    
    $installed = 0;
    
    foreach ($chores as $chore) {
        echo "<p>Installing: {$chore['title']}...</p>";
        
        // Convert 'today' to actual date
        $startDate = $chore['start_date'] === 'today' ? date('Y-m-d') : $chore['start_date'];
        
        $stmt = $db->prepare("
            INSERT INTO chores (
                title, description, default_points, requires_approval,
                recurrence_type, recurrence_value, start_date,
                assigned_kid_id, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $result = $stmt->execute([
            $chore['title'],
            $chore['description'] ?? '',
            $chore['default_points'],
            $chore['requires_approval'] ?? 1,
            $chore['recurrence_type'],
            $chore['recurrence_value'] ?? null,
            $startDate,
            $kidId,
            1 // admin user ID
        ]);
        
        if ($result) {
            $choreId = $db->lastInsertId();
            echo "<p style='color: green;'>✓ Chore created with ID: $choreId</p>";
            
            // Generate schedule
            echo "<p>Generating schedule...</p>";
            generateScheduleForChore($choreId);
            
            $scheduleCount = $db->query("SELECT COUNT(*) FROM chore_schedule WHERE chore_id = $choreId")->fetchColumn();
            echo "<p style='color: green;'>✓ Generated $scheduleCount schedule entries</p>";
            
            $installed++;
        } else {
            echo "<p style='color: red;'>✗ Failed to insert chore</p>";
        }
    }
    
    echo "<h2 style='color: green;'>Success!</h2>";
    echo "<p>Installed $installed chores</p>";
    
    echo "<br><br>";
    echo "<a href='admin/'>Go to Admin Panel</a> | ";
    echo "<a href='admin/index.html#chores'>View Chores</a>";
    
} catch (Exception $e) {
    echo "<h2 style='color: red;'>Error!</h2>";
    echo "<p>" . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
}
?>