<?php
/**
 * QUICK REWARDS FIX
 * Upload to: https://tasks.futuresrelic.com/fix-rewards-now.php
 * Then visit that URL in your browser
 */

require_once __DIR__ . '/config/config.php';

echo "<style>
body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 0 20px; }
.success { background: #d1fae5; padding: 20px; border-radius: 12px; color: #065f46; }
.error { background: #fee2e2; padding: 20px; border-radius: 12px; color: #991b1b; }
.info { background: #dbeafe; padding: 20px; border-radius: 12px; color: #1e40af; }
h1 { color: #374151; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
th { background: #f3f4f6; font-weight: 600; }
</style>";

echo "<h1>🔧 Rewards Database Fix</h1>";

try {
    $db = getDb();
    
    // Check current table structure
    echo "<h2>Step 1: Check Current Structure</h2>";
    $columns = $db->query("PRAGMA table_info(rewards)")->fetchAll(PDO::FETCH_ASSOC);
    
    $hasIsActive = false;
    $hasAvailable = false;
    
    echo "<table>";
    echo "<tr><th>Column Name</th><th>Type</th><th>Default</th></tr>";
    foreach ($columns as $col) {
        echo "<tr><td>{$col['name']}</td><td>{$col['type']}</td><td>{$col['dflt_value']}</td></tr>";
        if ($col['name'] === 'is_active') $hasIsActive = true;
        if ($col['name'] === 'available') $hasAvailable = true;
    }
    echo "</table>";
    
    // Fix the schema if needed
    echo "<h2>Step 2: Fix Schema</h2>";
    
    if ($hasAvailable && !$hasIsActive) {
        echo "<p>📝 Renaming 'available' to 'is_active'...</p>";
        $db->exec("ALTER TABLE rewards RENAME COLUMN available TO is_active");
        echo "<p style='color: green;'>✅ Renamed column successfully!</p>";
    } elseif (!$hasAvailable && !$hasIsActive) {
        echo "<p>📝 Adding 'is_active' column...</p>";
        $db->exec("ALTER TABLE rewards ADD COLUMN is_active INTEGER DEFAULT 1");
        echo "<p style='color: green;'>✅ Added is_active column!</p>";
    } elseif ($hasIsActive) {
        echo "<p style='color: green;'>✅ Table already has 'is_active' column!</p>";
    }
    
    // Show current rewards
    echo "<h2>Step 3: Current Rewards</h2>";
    $stmt = $db->query("SELECT * FROM rewards ORDER BY cost_points");
    $rewards = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($rewards)) {
        echo "<div class='info'>";
        echo "<p><strong>ℹ️ No rewards found in database</strong></p>";
        echo "<p>You may need to create some rewards in the admin panel.</p>";
        echo "</div>";
    } else {
        echo "<table>";
        echo "<tr><th>ID</th><th>Title</th><th>Cost</th><th>Active</th></tr>";
        foreach ($rewards as $reward) {
            $isActive = isset($reward['is_active']) ? $reward['is_active'] : 1;
            $status = $isActive ? '✅ Yes' : '❌ No';
            echo "<tr>";
            echo "<td>{$reward['id']}</td>";
            echo "<td>{$reward['title']}</td>";
            echo "<td>{$reward['cost_points']} points</td>";
            echo "<td>$status</td>";
            echo "</tr>";
        }
        echo "</table>";
        echo "<div class='success'>";
        echo "<p><strong>✅ Found " . count($rewards) . " reward(s)</strong></p>";
        echo "</div>";
    }
    
    echo "<hr>";
    echo "<h2>✅ Fix Complete!</h2>";
    echo "<div class='success'>";
    echo "<p><strong>Next steps:</strong></p>";
    echo "<ol>";
    echo "<li>Go to your kid app: <a href='/kid/'>https://tasks.futuresrelic.com/kid/</a></li>";
    echo "<li>Click on the Rewards tab</li>";
    echo "<li>Rewards should now appear!</li>";
    echo "</ol>";
    echo "</div>";
    
    echo "<br>";
    echo "<p><a href='admin/'>→ Admin Panel</a> | <a href='kid/'>→ Kid App</a></p>";
    
} catch (Exception $e) {
    echo "<div class='error'>";
    echo "<h3>❌ Error</h3>";
    echo "<p><strong>Message:</strong> " . $e->getMessage() . "</p>";
    echo "<p><strong>File:</strong> " . $e->getFile() . "</p>";
    echo "<p><strong>Line:</strong> " . $e->getLine() . "</p>";
    echo "</div>";
}
?>