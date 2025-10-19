<?php
require_once __DIR__ . '/config/config.php';

echo "<h1>Fixing Rewards Table Schema</h1>";

try {
    $db = getDb();
    
    // Check current structure
    $columns = $db->query("PRAGMA table_info(rewards)")->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<h2>Current Columns:</h2><ul>";
    foreach ($columns as $col) {
        echo "<li>{$col['name']} ({$col['type']})</li>";
    }
    echo "</ul>";
    
    // Check if created_by exists
    $hasCreatedBy = false;
    foreach ($columns as $col) {
        if ($col['name'] === 'created_by') {
            $hasCreatedBy = true;
            break;
        }
    }
    
    if ($hasCreatedBy) {
        echo "<p style='color: green;'>✓ Schema is already correct!</p>";
    } else {
        echo "<h2>Updating Schema...</h2>";
        
        // Rename old table
        $db->exec("ALTER TABLE rewards RENAME TO rewards_old");
        
        // Create new table with correct schema
        $db->exec("
            CREATE TABLE rewards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                cost_points INTEGER NOT NULL,
                available INTEGER DEFAULT 1,
                created_by INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        ");
        
        // Copy data from old table
        $db->exec("
            INSERT INTO rewards (id, title, description, cost_points, available, created_by, created_at)
            SELECT id, title, description, cost_points, 
                   COALESCE(available, 1), 
                   1 as created_by,
                   COALESCE(created_at, datetime('now'))
            FROM rewards_old
        ");
        
        $count = $db->query("SELECT COUNT(*) FROM rewards")->fetchColumn();
        echo "<p style='color: green;'>✓ Migrated $count rewards</p>";
        
        // Drop old table
        $db->exec("DROP TABLE rewards_old");
        
        echo "<p style='color: green;'>✓ Schema updated successfully!</p>";
    }
    
    echo "<br><br>";
    echo "<div style='background: #d1fae5; padding: 20px; border-radius: 8px;'>";
    echo "<h3>✅ Rewards Table Fixed!</h3>";
    echo "<p>The wizard should now work perfectly.</p>";
    echo "</div>";
    
    echo "<br>";
    echo "<a href='admin/' style='display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px;'>Try the Setup Wizard!</a>";
    
} catch (Exception $e) {
    echo "<p style='color: red;'><strong>Error:</strong> " . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
}
?>