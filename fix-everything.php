<?php
require_once __DIR__ . '/config/config.php';
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>ChoreQuest - Fix Everything</title>
    <style>
        body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
        .success { background: #d1fae5; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .error { background: #fee2e2; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .info { background: #dbeafe; padding: 15px; border-radius: 8px; margin: 10px 0; }
        h1 { color: #4f46e5; }
        h2 { color: #6366f1; margin-top: 30px; }
        code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
    </style>
</head>
<body>
<h1>🔧 ChoreQuest - Fix Everything</h1>

<?php
try {
    $db = getDb();
    $fixed = [];
    $errors = [];
    
    // ============================================
    // FIX 1: Rewards Table Schema
    // ============================================
    echo "<h2>1️⃣ Fixing Rewards Table...</h2>";
    
    $columns = $db->query("PRAGMA table_info(rewards)")->fetchAll(PDO::FETCH_ASSOC);
    $hasIsActive = false;
    $hasAvailable = false;
    $hasCreatedBy = false;
    
    foreach ($columns as $col) {
        if ($col['name'] === 'is_active') $hasIsActive = true;
        if ($col['name'] === 'available') $hasAvailable = true;
        if ($col['name'] === 'created_by') $hasCreatedBy = true;
    }
    
    if (!$hasIsActive) {
        echo "<div class='info'>Adding <code>is_active</code> column...</div>";
        
        if ($hasAvailable) {
            // Rename available to is_active
            $db->exec("ALTER TABLE rewards RENAME COLUMN available TO is_active");
            $fixed[] = "Renamed 'available' to 'is_active'";
        } else {
            // Add is_active column
            $db->exec("ALTER TABLE rewards ADD COLUMN is_active INTEGER DEFAULT 1");
            $fixed[] = "Added 'is_active' column";
        }
    } else {
        echo "<div class='success'>✓ Rewards table already has is_active column</div>";
    }
    
    if (!$hasCreatedBy) {
        echo "<div class='info'>Adding <code>created_by</code> column...</div>";
        $db->exec("ALTER TABLE rewards ADD COLUMN created_by INTEGER DEFAULT 1");
        $fixed[] = "Added 'created_by' column";
    }
    
    // Verify rewards table is working
    $count = $db->query("SELECT COUNT(*) FROM rewards")->fetchColumn();
    echo "<div class='success'>✓ Rewards table working! Found $count rewards.</div>";
    
    // ============================================
    // FIX 2: Update API queries
    // ============================================
    echo "<h2>2️⃣ Checking API File...</h2>";
    
    $apiFile = __DIR__ . '/api/api.php';
    if (file_exists($apiFile)) {
        $apiContent = file_get_contents($apiFile);
        
        // Check if available is still being used
        if (strpos($apiContent, "r.available") !== false) {
            echo "<div class='info'>⚠️ Found old 'available' references in api.php</div>";
            echo "<div class='info'>Replace all instances of <code>r.available</code> with <code>r.is_active</code> in /api/api.php</div>";
        } else {
            echo "<div class='success'>✓ API file looks good!</div>";
        }
    }
    
    // ============================================
    // SUMMARY
    // ============================================
    echo "<h2>📊 Summary</h2>";
    
    if (!empty($fixed)) {
        echo "<div class='success'>";
        echo "<h3>✅ Fixed:</h3><ul>";
        foreach ($fixed as $fix) {
            echo "<li>$fix</li>";
        }
        echo "</ul></div>";
    }
    
    if (!empty($errors)) {
        echo "<div class='error'>";
        echo "<h3>❌ Errors:</h3><ul>";
        foreach ($errors as $error) {
            echo "<li>$error</li>";
        }
        echo "</ul></div>";
    } else {
        echo "<div class='success'>";
        echo "<h3>🎉 All Fixed!</h3>";
        echo "<p>Your rewards system should work now. Try redeeming a reward!</p>";
        echo "</div>";
    }
    
    echo "<h2>🧪 Quick Test</h2>";
    echo "<div class='info'>";
    echo "<p>Let's verify the fix worked:</p>";
    
    // Test query
    $stmt = $db->query("
        SELECT id, title, cost_points, is_active 
        FROM rewards 
        WHERE is_active = 1 
        LIMIT 5
    ");
    $activeRewards = $stmt->fetchAll();
    
    if (!empty($activeRewards)) {
        echo "<p><strong>✓ Active Rewards Query Works!</strong></p>";
        echo "<table border='1' cellpadding='8' style='border-collapse: collapse;'>";
        echo "<tr style='background: #f3f4f6;'><th>ID</th><th>Title</th><th>Cost</th><th>Active</th></tr>";
        foreach ($activeRewards as $r) {
            echo "<tr>";
            echo "<td>{$r['id']}</td>";
            echo "<td>{$r['title']}</td>";
            echo "<td>{$r['cost_points']}</td>";
            echo "<td>" . ($r['is_active'] ? '✓' : '✗') . "</td>";
            echo "</tr>";
        }
        echo "</table>";
    } else {
        echo "<p><em>No active rewards found. Create some rewards first!</em></p>";
    }
    
    echo "</div>";
    
} catch (Exception $e) {
    echo "<div class='error'>";
    echo "<h3>❌ Error:</h3>";
    echo "<p>" . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
    echo "</div>";
}
?>

<hr>
<p><a href="admin/" style="padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px;">→ Go to Admin Panel</a></p>
<p><a href="kid/" style="padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">→ Go to Kid Panel</a></p>

</body>
</html>
