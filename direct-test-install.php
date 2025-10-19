<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/api/scheduler.php';

startSession();
$_SESSION['user_id'] = 1;
$_SESSION['user_role'] = 'admin';

echo "<h1>Direct Install Test (Bypassing API)</h1>";
echo "<p>This simulates exactly what the wizard does:</p>";

try {
    // Load presets
    $presetsFile = __DIR__ . '/chore-presets.json';
    $presets = json_decode(file_get_contents($presetsFile), true);
    
    $db = getDb();
    
    // Test installing morning_routine
    echo "<h2>Installing Morning Routine (7 chores)</h2>";
    $category = 'morning_routine';
    $chores = $presets[$category];
    $kidId = null;
    $installed = 0;
    
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
            1
        ]);
        
        $choreId = $db->lastInsertId();
        generateScheduleForChore($choreId);
        
        $installed++;
        echo "<p>✓ Installed: {$chore['title']} (ID: $choreId)</p>";
    }
    
    echo "<p style='color: green; font-size: 18px; font-weight: bold;'>✅ Successfully installed $installed chores!</p>";
    
    // Test installing rewards
    echo "<h2>Installing Rewards (21 rewards)</h2>";
    $rewards = $presets['rewards'];
    $installedRewards = 0;
    
    foreach ($rewards as $reward) {
        $stmt = $db->prepare("
            INSERT INTO rewards (title, description, cost_points, created_by)
            VALUES (?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $reward['title'],
            $reward['description'] ?? '',
            $reward['cost_points'],
            1
        ]);
        
        $installedRewards++;
    }
    
    echo "<p style='color: green; font-size: 18px; font-weight: bold;'>✅ Successfully installed $installedRewards rewards!</p>";
    
    echo "<br><br>";
    echo "<div style='background: #d1fae5; padding: 30px; border-radius: 12px;'>";
    echo "<h2>🎉 Complete Success!</h2>";
    echo "<p><strong>Total installed:</strong></p>";
    echo "<ul>";
    echo "<li>$installed chores (Morning Routine)</li>";
    echo "<li>$installedRewards rewards</li>";
    echo "</ul>";
    echo "<p>Everything is working! The wizard should work too.</p>";
    echo "</div>";
    
    echo "<br><br>";
    echo "<a href='admin/' style='display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px;'>View in Admin Panel →</a>";
    
} catch (Exception $e) {
    echo "<div style='background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;'>";
    echo "<h2 style='color: #991b1b;'>❌ Error!</h2>";
    echo "<p><strong>Message:</strong> " . $e->getMessage() . "</p>";
    echo "<p><strong>File:</strong> " . $e->getFile() . "</p>";
    echo "<p><strong>Line:</strong> " . $e->getLine() . "</p>";
    echo "<pre style='background: white; padding: 15px; border-radius: 8px; overflow: auto;'>" . $e->getTraceAsString() . "</pre>";
    echo "</div>";
}
?>