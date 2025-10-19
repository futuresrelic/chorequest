<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config/config.php';

echo "<h1>Testing Wizard API Endpoints</h1>";

// Start session and simulate admin login
startSession();
$_SESSION['user_id'] = 1;
$_SESSION['user_role'] = 'admin';

// Test 1: Load presets
echo "<h2>Test 1: load_chore_presets</h2>";
try {
    $presetsFile = __DIR__ . '/chore-presets.json';
    
    if (!file_exists($presetsFile)) {
        echo "<p style='color: red;'>❌ Presets file not found at: $presetsFile</p>";
    } else {
        $presets = json_decode(file_get_contents($presetsFile), true);
        echo "<p style='color: green;'>✓ Loaded presets with " . count($presets) . " categories</p>";
        echo "<ul>";
        foreach (array_keys($presets) as $category) {
            $count = is_array($presets[$category]) ? count($presets[$category]) : 0;
            echo "<li>$category: $count items</li>";
        }
        echo "</ul>";
    }
} catch (Exception $e) {
    echo "<p style='color: red;'>Error: " . $e->getMessage() . "</p>";
}

// Test 2: Install preset category
echo "<h2>Test 2: install_preset_category</h2>";
try {
    require_once __DIR__ . '/api/scheduler.php';
    
    $presetsFile = __DIR__ . '/chore-presets.json';
    $presets = json_decode(file_get_contents($presetsFile), true);
    
    // Get just first chore from morning routine
    $testChore = [$presets['morning_routine'][0]];
    
    echo "<p>Testing with 1 chore: {$testChore[0]['title']}</p>";
    
    $db = getDb();
    $installed = 0;
    
    foreach ($testChore as $chore) {
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
            null,
            1
        ]);
        
        $choreId = $db->lastInsertId();
        generateScheduleForChore($choreId);
        
        $installed++;
        
        // Clean up
        $db->exec("DELETE FROM chore_schedule WHERE chore_id = $choreId");
        $db->exec("DELETE FROM chores WHERE id = $choreId");
    }
    
    echo "<p style='color: green;'>✓ Successfully installed and cleaned up $installed chore(s)</p>";
    
} catch (Exception $e) {
    echo "<p style='color: red;'>Error: " . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
}

// Test 3: Install preset rewards
echo "<h2>Test 3: install_preset_rewards</h2>";
try {
    $presetsFile = __DIR__ . '/chore-presets.json';
    $presets = json_decode(file_get_contents($presetsFile), true);
    
    // Get just first reward
    $testReward = [$presets['rewards'][0]];
    
    echo "<p>Testing with 1 reward: {$testReward[0]['title']}</p>";
    
    $db = getDb();
    $installed = 0;
    
    foreach ($testReward as $reward) {
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
        
        $rewardId = $db->lastInsertId();
        $installed++;
        
        // Clean up
        $db->exec("DELETE FROM rewards WHERE id = $rewardId");
    }
    
    echo "<p style='color: green;'>✓ Successfully installed and cleaned up $installed reward(s)</p>";
    
} catch (Exception $e) {
    echo "<p style='color: red;'>Error: " . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
}

// Test 4: Check if API endpoints exist
echo "<h2>Test 4: Check API File</h2>";
$apiFile = __DIR__ . '/api/api.php';
$apiContent = file_get_contents($apiFile);

$endpoints = [
    'load_chore_presets',
    'install_preset_category', 
    'install_preset_rewards'
];

foreach ($endpoints as $endpoint) {
    if (strpos($apiContent, "case '$endpoint':") !== false) {
        echo "<p style='color: green;'>✓ Found: $endpoint</p>";
    } else {
        echo "<p style='color: red;'>❌ Missing: $endpoint</p>";
    }
}

echo "<br><br>";
echo "<a href='admin/'>Back to Admin</a>";
?>