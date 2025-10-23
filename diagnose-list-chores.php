<?php
/**
 * DIAGNOSE list_kid_chores ERROR
 * 
 * Upload to: https://tasks.futuresrelic.com/diagnose-list-chores.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<style>
body { font-family: system-ui; max-width: 900px; margin: 40px auto; padding: 0 20px; }
.error { background: #fee; padding: 20px; border-radius: 8px; color: #c00; }
.success { background: #efe; padding: 20px; border-radius: 8px; color: #060; }
pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
</style>";

echo "<h1>🔍 Diagnosing list_kid_chores Error</h1>";

require_once __DIR__ . '/config/config.php';

startSession();
$_SESSION['admin_id'] = 1;

try {
    $db = getDb();
    
    // Get first kid
    $stmt = $db->query("SELECT id, kid_name FROM users WHERE role = 'kid' LIMIT 1");
    $kid = $stmt->fetch();
    
    if (!$kid) {
        echo "<p class='error'>No kids found in database</p>";
        exit;
    }
    
    echo "<h2>Testing with Kid: {$kid['kid_name']} (ID: {$kid['id']})</h2>";
    
    // Check what columns exist in kid_chores
    echo "<h3>Checking kid_chores table structure:</h3>";
    $columns = $db->query("PRAGMA table_info(kid_chores)")->fetchAll(PDO::FETCH_ASSOC);
    echo "<ul>";
    foreach ($columns as $col) {
        echo "<li>{$col['name']} ({$col['type']})</li>";
    }
    echo "</ul>";
    
    // Check what columns exist in chores table
    echo "<h3>Checking chores table structure:</h3>";
    $columns = $db->query("PRAGMA table_info(chores)")->fetchAll(PDO::FETCH_ASSOC);
    echo "<ul>";
    foreach ($columns as $col) {
        echo "<li>{$col['name']} ({$col['type']})</li>";
    }
    echo "</ul>";
    
    // Try the actual query from list_kid_chores
    echo "<h3>Testing the list_kid_chores query:</h3>";
    
    $testQuery = "
        SELECT kc.*, c.title, c.description, c.recurrence_type, 
               c.default_points, c.requires_approval,
               CASE 
                   WHEN datetime(kc.next_due_at) <= datetime('now') THEN 1 
                   ELSE 0 
               END as is_due
        FROM kid_chores kc
        JOIN chores c ON kc.chore_id = c.id
        WHERE kc.kid_user_id = ?
        ORDER BY is_due DESC, kc.next_due_at
    ";
    
    echo "<p>Running query...</p>";
    
    try {
        $stmt = $db->prepare($testQuery);
        $stmt->execute([$kid['id']]);
        $chores = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "<div class='success'>";
        echo "<p>✅ Query successful! Found " . count($chores) . " chores.</p>";
        echo "</div>";
        
        if (count($chores) > 0) {
            echo "<h3>Chore Details:</h3>";
            foreach ($chores as $chore) {
                echo "<div style='background: #f9f9f9; padding: 15px; margin: 10px 0; border-radius: 5px;'>";
                echo "<strong>{$chore['title']}</strong><br>";
                echo "Recurrence Type: {$chore['recurrence_type']}<br>";
                echo "Next Due: {$chore['next_due_at']}<br>";
                echo "Is Due: " . ($chore['is_due'] ? 'YES' : 'NO') . "<br>";
                echo "Points: {$chore['default_points']}<br>";
                
                // Check if next_due_at is in the past
                $dueTime = strtotime($chore['next_due_at']);
                $now = time();
                $diff = $now - $dueTime;
                
                if ($diff > 0) {
                    $hours = floor($diff / 3600);
                    echo "<span style='color: green;'>✅ Due {$hours} hours ago (should be available)</span>";
                } else {
                    $hours = floor(abs($diff) / 3600);
                    echo "<span style='color: orange;'>⏰ Due in {$hours} hours</span>";
                }
                
                echo "</div>";
            }
        }
        
    } catch (Exception $e) {
        echo "<div class='error'>";
        echo "<h3>❌ Query Failed!</h3>";
        echo "<p><strong>Error:</strong> " . $e->getMessage() . "</p>";
        echo "<p><strong>This is your problem!</strong></p>";
        echo "</div>";
        
        // Common issues
        if (strpos($e->getMessage(), 'no such column') !== false) {
            preg_match('/no such column: (.+)/', $e->getMessage(), $matches);
            $missingCol = $matches[1] ?? 'unknown';
            
            echo "<h3>Fix:</h3>";
            echo "<p>The column <code>{$missingCol}</code> doesn't exist.</p>";
            
            if (strpos($missingCol, 'is_recurring') !== false) {
                echo "<p><strong>Problem:</strong> You're still referencing <code>is_recurring</code> somewhere.</p>";
                echo "<p><strong>Solution:</strong> Replace with logic using <code>recurrence_type</code></p>";
            } elseif (strpos($missingCol, 'frequency') !== false) {
                echo "<p><strong>Problem:</strong> You're still referencing <code>frequency</code> somewhere.</p>";
                echo "<p><strong>Solution:</strong> Replace with <code>recurrence_type</code></p>";
            }
        }
        
        throw $e;
    }
    
    // Check the actual data in kid_chores
    echo "<h3>Raw kid_chores data:</h3>";
    $stmt = $db->query("SELECT * FROM kid_chores WHERE kid_user_id = {$kid['id']}");
    $kidChores = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($kidChores) > 0) {
        echo "<pre>";
        print_r($kidChores);
        echo "</pre>";
    } else {
        echo "<p>No chores assigned to this kid yet.</p>";
    }
    
    echo "<hr>";
    echo "<h2>✅ Diagnosis Complete</h2>";
    
} catch (Exception $e) {
    echo "<div class='error'>";
    echo "<h2>❌ Error During Diagnosis</h2>";
    echo "<p><strong>Message:</strong> " . $e->getMessage() . "</p>";
    echo "<p><strong>File:</strong> " . $e->getFile() . "</p>";
    echo "<p><strong>Line:</strong> " . $e->getLine() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
    echo "</div>";
}

echo "<hr>";
echo "<p><a href='admin/'>← Back to Admin Panel</a></p>";
?>
