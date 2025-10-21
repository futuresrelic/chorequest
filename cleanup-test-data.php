<?php
require_once __DIR__ . '/config/config.php';

echo "<h1>Cleanup Test Data</h1>";
echo "<p>This will remove all chores and rewards created during testing.</p>";

try {
    $db = getDb();
    
    // Check what tables exist
    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
    
    echo "<h2>Available Tables:</h2>";
    echo "<ul>";
    foreach ($tables as $table) {
        echo "<li>$table</li>";
    }
    echo "</ul>";
    
    // Show what will be deleted
    echo "<h2>Current Data:</h2>";
    
    $choreCount = $db->query("SELECT COUNT(*) FROM chores")->fetchColumn();
    $rewardCount = $db->query("SELECT COUNT(*) FROM rewards")->fetchColumn();
    
    $scheduleCount = 0;
    if (in_array('chore_schedule', $tables)) {
        $scheduleCount = $db->query("SELECT COUNT(*) FROM chore_schedule")->fetchColumn();
    }
    
    echo "<ul>";
    echo "<li>Chores: $choreCount</li>";
    echo "<li>Rewards: $rewardCount</li>";
    echo "<li>Schedule entries: $scheduleCount</li>";
    echo "</ul>";
    
    if (isset($_GET['confirm']) && $_GET['confirm'] === 'yes') {
        echo "<h2>Deleting...</h2>";
        
        // Delete in safe order - only delete from tables that exist
        if (in_array('chore_schedule', $tables)) {
            $db->exec("DELETE FROM chore_schedule");
            echo "<p>✓ Cleared chore_schedule</p>";
        }
        
        if (in_array('submissions', $tables)) {
            $db->exec("DELETE FROM submissions");
            echo "<p>✓ Cleared submissions</p>";
        }
        
        if (in_array('kid_chores', $tables)) {
            $db->exec("DELETE FROM kid_chores");
            echo "<p>✓ Cleared kid_chores</p>";
        }
        
        $db->exec("DELETE FROM chores");
        echo "<p>✓ Cleared chores</p>";
        
        if (in_array('redemptions', $tables)) {
            $db->exec("DELETE FROM redemptions");
            echo "<p>✓ Cleared redemptions</p>";
        }
        
        $db->exec("DELETE FROM rewards");
        echo "<p>✓ Cleared rewards</p>";
        
        // Reset auto-increment counters
        $db->exec("DELETE FROM sqlite_sequence WHERE name IN ('chores', 'rewards', 'chore_schedule', 'submissions', 'redemptions', 'kid_chores')");
        echo "<p>✓ Reset ID counters</p>";
        
        echo "<div style='background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0;'>";
        echo "<h3 style='color: #065f46;'>✅ Cleanup Complete!</h3>";
        echo "<p>All test chores and rewards have been removed.</p>";
        echo "<p>The database is now clean and ready for the wizard.</p>";
        echo "</div>";
        
        echo "<br>";
        echo "<a href='admin/' style='display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px;'>Run Setup Wizard →</a>";
        
    } else {
        echo "<br><br>";
        echo "<div style='background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;'>";
        echo "<h3 style='color: #92400e;'>⚠️ Warning</h3>";
        echo "<p>This will permanently delete:</p>";
        echo "<ul>";
        echo "<li>All $choreCount chores</li>";
        echo "<li>All $rewardCount rewards</li>";
        if ($scheduleCount > 0) {
            echo "<li>All $scheduleCount schedule entries</li>";
        }
        echo "<li>All related submissions and redemptions</li>";
        echo "</ul>";
        echo "<p><strong>Kids, devices, and admin users will NOT be deleted.</strong></p>";
        echo "</div>";
        
        echo "<br><br>";
        echo "<a href='?confirm=yes' style='display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;'>Yes, Delete Everything →</a>";
        echo " ";
        echo "<a href='admin/' style='display: inline-block; padding: 12px 24px; background: #6b7280; color: white; text-decoration: none; border-radius: 8px;'>Cancel</a>";
    }
    
} catch (Exception $e) {
    echo "<div style='background: #fee2e2; padding: 20px; border-radius: 8px;'>";
    echo "<h3 style='color: #991b1b;'>Error</h3>";
    echo "<p>" . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
    echo "</div>";
}
?>