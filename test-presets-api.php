<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config/config.php';

echo "<h1>Testing Preset API</h1>";

// Test 1: Load presets file
echo "<h2>Test 1: Load Presets File</h2>";
$presetsFile = __DIR__ . '/chore-presets.json';
echo "<p>File path: $presetsFile</p>";
echo "<p>File exists: " . (file_exists($presetsFile) ? 'YES' : 'NO') . "</p>";

if (file_exists($presetsFile)) {
    $content = file_get_contents($presetsFile);
    echo "<p>File size: " . strlen($content) . " bytes</p>";
    
    $presets = json_decode($content, true);
    if ($presets === null) {
        echo "<p style='color: red;'>JSON Error: " . json_last_error_msg() . "</p>";
    } else {
        echo "<p style='color: green;'>JSON parsed successfully!</p>";
        echo "<p>Categories found: " . implode(', ', array_keys($presets)) . "</p>";
        
        // Test a category
        if (isset($presets['morning_routine'])) {
            echo "<h3>Morning Routine Chores:</h3>";
            echo "<ul>";
            foreach ($presets['morning_routine'] as $chore) {
                echo "<li>{$chore['title']} - {$chore['default_points']} points</li>";
            }
            echo "</ul>";
        }
    }
}

// Test 2: Check if scheduler.php exists
echo "<h2>Test 2: Check Scheduler</h2>";
$schedulerPath = __DIR__ . '/api/scheduler.php';
echo "<p>Scheduler path: $schedulerPath</p>";
echo "<p>Scheduler exists: " . (file_exists($schedulerPath) ? 'YES' : 'NO') . "</p>";

// Test 3: Try to insert a test chore
echo "<h2>Test 3: Database Insert Test</h2>";
try {
    $db = getDb();
    
    // Create a test admin user if needed
    $stmt = $db->query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    $admin = $stmt->fetch();
    
    if (!$admin) {
        echo "<p style='color: red;'>No admin user found!</p>";
    } else {
        echo "<p style='color: green;'>Admin user ID: {$admin['id']}</p>";
        
        // Try inserting a test chore
        $stmt = $db->prepare("
            INSERT INTO chores (
                title, description, default_points, requires_approval,
                recurrence_type, start_date, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        
        $result = $stmt->execute([
            'TEST CHORE - DELETE ME',
            'This is a test',
            10,
            1,
            'daily',
            date('Y-m-d'),
            $admin['id']
        ]);
        
        if ($result) {
            $choreId = $db->lastInsertId();
            echo "<p style='color: green;'>Test chore inserted! ID: $choreId</p>";
            
            // Clean up
            $db->exec("DELETE FROM chores WHERE id = $choreId");
            echo "<p>Test chore deleted.</p>";
        }
    }
    
} catch (Exception $e) {
    echo "<p style='color: red;'>Database error: " . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
}

echo "<br><br><a href='admin/'>Back to Admin</a>";
?>