<?php
require_once __DIR__ . '/config/config.php';

echo "<h1>Updating Database Schema</h1>";

try {
    $db = getDb();
    
    // Check current chores table structure
    $columns = $db->query("PRAGMA table_info(chores)")->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<h2>Current Columns:</h2><ul>";
    foreach ($columns as $col) {
        echo "<li>{$col['name']} ({$col['type']})</li>";
    }
    echo "</ul>";
    
    // Check if recurrence_type exists
    $hasRecurrence = false;
    foreach ($columns as $col) {
        if ($col['name'] === 'recurrence_type') {
            $hasRecurrence = true;
            break;
        }
    }
    
    if ($hasRecurrence) {
        echo "<p style='color: green;'>✓ Schema is already up to date!</p>";
    } else {
        echo "<h2>Migrating to New Schema...</h2>";
        
        // Rename old table
        $db->exec("ALTER TABLE chores RENAME TO chores_old");
        
        // Create new table with correct schema
        $db->exec("
            CREATE TABLE chores (
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
            )
        ");
        
        // Migrate data from old schema to new schema
        $db->exec("
            INSERT INTO chores (
                id, title, description, default_points, requires_approval, 
                recurrence_type, recurrence_value, start_date, 
                assigned_kid_id, created_by, created_at
            )
            SELECT 
                id, 
                title, 
                description, 
                default_points, 
                requires_approval,
                CASE 
                    WHEN is_recurring = 1 THEN 'daily'
                    ELSE 'once'
                END as recurrence_type,
                frequency as recurrence_value,
                date('now') as start_date,
                NULL as assigned_kid_id,
                created_by,
                created_at
            FROM chores_old
        ");
        
        echo "<p style='color: green;'>✓ Migrated " . $db->query("SELECT COUNT(*) FROM chores")->fetchColumn() . " chores</p>";
        
        // Drop old table
        $db->exec("DROP TABLE chores_old");
        
        echo "<p style='color: green;'>✓ Schema updated successfully!</p>";
    }
    
    // Also check/update chore_schedule table
    echo "<h2>Checking chore_schedule Table...</h2>";
    
    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='chore_schedule'")->fetchAll();
    
    if (empty($tables)) {
        echo "<p>Creating chore_schedule table...</p>";
        $db->exec("
            CREATE TABLE chore_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chore_id INTEGER NOT NULL,
                due_at DATETIME NOT NULL,
                FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE CASCADE
            )
        ");
        echo "<p style='color: green;'>✓ chore_schedule table created!</p>";
    } else {
        echo "<p style='color: green;'>✓ chore_schedule table exists</p>";
    }
    
    echo "<br><br>";
    echo "<div style='background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0;'>";
    echo "<h3>✅ Database Update Complete!</h3>";
    echo "<p>Your database is now ready for the preset wizard.</p>";
    echo "</div>";
    
    echo "<a href='admin/' style='display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin-right: 10px;'>Go to Admin Panel</a>";
    echo "<a href='test-presets-api.php' style='display: inline-block; padding: 12px 24px; background: #6b7280; color: white; text-decoration: none; border-radius: 8px;'>Test Presets API</a>";
    
} catch (Exception $e) {
    echo "<p style='color: red;'><strong>Error:</strong> " . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
}
?>