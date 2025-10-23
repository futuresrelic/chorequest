<?php
/**
 * DIAGNOSTIC SCRIPT - Place this in your root directory
 * 
 * Run this file: https://tasks.futuresrelic.com/diagnose-admin-error.php
 * 
 * This will help identify EXACTLY what's causing the 500 error when
 * assigning chores.
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>🔍 Admin API Diagnostic</h1>";
echo "<p>Testing the assign_chore_to_kid endpoint...</p>";

// Include your config
require_once __DIR__ . '/config/config.php';

// Start session
startSession();

// Create a fake admin session for testing
$_SESSION['admin_id'] = 1;
$_SESSION['user_role'] = 'admin';

echo "<h2>✅ Config loaded successfully</h2>";

// Test database connection
try {
    $db = getDb();
    echo "<h2>✅ Database connection successful</h2>";
    
    // Check if we have kids
    $stmt = $db->query("SELECT id, kid_name FROM users WHERE role = 'kid' LIMIT 5");
    $kids = $stmt->fetchAll();
    echo "<h3>Kids in database:</h3><ul>";
    foreach ($kids as $kid) {
        echo "<li>ID: {$kid['id']}, Name: {$kid['kid_name']}</li>";
    }
    echo "</ul>";
    
    // Check if we have chores
    $stmt = $db->query("SELECT id, title, frequency FROM chores LIMIT 5");
    $chores = $stmt->fetchAll();
    echo "<h3>Chores in database:</h3><ul>";
    foreach ($chores as $chore) {
        echo "<li>ID: {$chore['id']}, Title: {$chore['title']}, Frequency: {$chore['frequency']}</li>";
    }
    echo "</ul>";
    
} catch (Exception $e) {
    echo "<h2 style='color: red;'>❌ Database error:</h2>";
    echo "<pre>" . $e->getMessage() . "</pre>";
    exit;
}

// Now test the actual assign_chore_to_kid logic
echo "<h2>Testing assign_chore_to_kid logic...</h2>";

if (count($kids) > 0 && count($chores) > 0) {
    $testKidId = $kids[0]['id'];
    $testChoreId = $chores[0]['id'];
    
    echo "<p>Testing with Kid ID: {$testKidId} ({$kids[0]['kid_name']}) and Chore ID: {$testChoreId} ({$chores[0]['title']})</p>";
    
    try {
        // This is the EXACT code from your assign_chore_to_kid case
        $kidId = intval($testKidId);
        $choreId = intval($testChoreId);
        
        if (!$kidId || !$choreId) {
            throw new Exception('Kid ID and Chore ID required');
        }
        
        $db = getDb();
        
        echo "<p>✅ Got database connection</p>";
        
        $stmt = $db->prepare("SELECT frequency FROM chores WHERE id = ?");
        $stmt->execute([$choreId]);
        $chore = $stmt->fetch();
        
        echo "<p>✅ Found chore: frequency = {$chore['frequency']}</p>";
        
        if (!$chore) {
            throw new Exception('Chore not found');
        }
        
        // Check if calculateNextDue function exists
        if (!function_exists('calculateNextDue')) {
            echo "<p style='color: red;'>❌ ERROR: calculateNextDue() function not found!</p>";
            echo "<p>This is your problem. The function is missing or not defined in config.php</p>";
            
            // Show what's in config.php
            echo "<h3>Checking config.php for calculateNextDue...</h3>";
            $configContent = file_get_contents(__DIR__ . '/config/config.php');
            if (strpos($configContent, 'function calculateNextDue') !== false) {
                echo "<p style='color: green;'>✅ calculateNextDue IS defined in config.php</p>";
            } else {
                echo "<p style='color: red;'>❌ calculateNextDue IS NOT defined in config.php</p>";
                echo "<p><strong>FIX:</strong> Add this function to your config/config.php file:</p>";
                echo "<pre>";
                echo htmlspecialchars('
function calculateNextDue($frequency) {
    switch ($frequency) {
        case \'daily\':
            return date(\'Y-m-d H:i:s\', strtotime(\'+1 day\'));
        case \'weekly\':
            return date(\'Y-m-d H:i:s\', strtotime(\'+1 week\'));
        case \'once\':
            return null;
        default:
            return date(\'Y-m-d H:i:s\', strtotime(\'+1 day\'));
    }
}
');
                echo "</pre>";
            }
            exit;
        }
        
        $nextDue = calculateNextDue($chore['frequency']);
        echo "<p>✅ Calculated next due: {$nextDue}</p>";
        
        $stmt = $db->prepare("
            INSERT OR IGNORE INTO kid_chores (kid_user_id, chore_id, next_due_at) 
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$kidId, $choreId, $nextDue]);
        
        echo "<p>✅ Inserted into kid_chores</p>";
        
        // Check if logAudit function exists
        if (function_exists('logAudit')) {
            logAudit($_SESSION['admin_id'], 'assign_chore', ['kid_id' => $kidId, 'chore_id' => $choreId]);
            echo "<p>✅ Audit log created</p>";
        } else {
            echo "<p style='color: orange;'>⚠️ logAudit function not found (this is OK, it's optional)</p>";
        }
        
        echo "<h2 style='color: green;'>✅ SUCCESS!</h2>";
        echo "<p>The assign_chore_to_kid logic works perfectly!</p>";
        echo "<p><strong>This means the error is happening elsewhere in your api.php file.</strong></p>";
        
        // Clean up test data
        $db->exec("DELETE FROM kid_chores WHERE kid_user_id = {$kidId} AND chore_id = {$choreId}");
        echo "<p><em>(Test assignment removed)</em></p>";
        
    } catch (Exception $e) {
        echo "<h2 style='color: red;'>❌ ERROR FOUND!</h2>";
        echo "<p><strong>Error message:</strong> " . $e->getMessage() . "</p>";
        echo "<p><strong>File:</strong> " . $e->getFile() . "</p>";
        echo "<p><strong>Line:</strong> " . $e->getLine() . "</p>";
        echo "<pre>" . $e->getTraceAsString() . "</pre>";
    }
} else {
    echo "<p style='color: orange;'>⚠️ Cannot test - you need at least 1 kid and 1 chore in your database</p>";
}

echo "<hr>";
echo "<h2>Next Steps:</h2>";
echo "<ol>";
echo "<li>If you see any RED errors above, that's your problem - fix those first</li>";
echo "<li>If everything is GREEN, the issue is in how api.php is handling the request</li>";
echo "<li>Check your api.php file for syntax errors (missing semicolons, brackets, etc)</li>";
echo "<li>Make sure the 'assign_chore_to_kid' case is EXACTLY as shown in api_fixes.php</li>";
echo "</ol>";

echo "<hr>";
echo "<p><a href='admin/'>← Back to Admin Panel</a></p>";
?>
