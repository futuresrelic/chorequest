<?php
/**
 * API ENDPOINT CHECKER
 * 
 * This script scans your api.php file and checks if all admin endpoints
 * have $db = getDb(); before using the database.
 * 
 * Upload to: https://tasks.futuresrelic.com/check-endpoints.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<style>
body { font-family: system-ui; max-width: 1200px; margin: 20px auto; padding: 0 20px; }
.good { color: green; }
.bad { color: red; }
.warning { color: orange; }
pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
th { background: #f0f0f0; }
</style>";

echo "<h1>🔍 API Endpoint Checker</h1>";

$apiFile = __DIR__ . '/api/api.php';

if (!file_exists($apiFile)) {
    echo "<p class='bad'>❌ api/api.php not found!</p>";
    exit;
}

echo "<p class='good'>✅ Found api.php</p>";

$content = file_get_contents($apiFile);

// Admin endpoints that typically need database access
$adminEndpoints = [
    'assign_chore_to_kid',
    'unassign_chore',
    'list_kid_chores',
    'create_chore',
    'list_chores',
    'update_chore',
    'delete_chore',
    'create_reward',
    'list_rewards',
    'delete_reward',
    'approve_submission',
    'reject_submission',
    'list_submissions',
    'create_quest',
    'list_quests',
    'delete_quest',
    'create_kid',
    'list_kids',
    'delete_kid',
    'generate_pairing_code'
];

echo "<h2>Checking Admin Endpoints</h2>";
echo "<table>";
echo "<tr><th>Endpoint</th><th>Has $db = getDb()?</th><th>Status</th></tr>";

$issues = [];

foreach ($adminEndpoints as $endpoint) {
    $pattern = "/case\s+['\"]" . preg_quote($endpoint, '/') . "['\"]\s*:(.*?)break;/s";
    
    if (preg_match($pattern, $content, $matches)) {
        $caseContent = $matches[1];
        
        // Check if it has $db = getDb() or just getDb()
        $hasGetDb = strpos($caseContent, 'getDb()') !== false;
        $hasDbAssignment = strpos($caseContent, '$db = getDb()') !== false;
        
        // Check if it uses $db-> or $stmt
        $usesDatabase = strpos($caseContent, '$db->') !== false || strpos($caseContent, '$stmt') !== false;
        
        if ($usesDatabase && !$hasGetDb) {
            echo "<tr><td>{$endpoint}</td><td class='bad'>❌ NO</td><td class='bad'>MISSING - Needs $db = getDb()</td></tr>";
            $issues[] = $endpoint;
        } elseif ($usesDatabase && $hasDbAssignment) {
            echo "<tr><td>{$endpoint}</td><td class='good'>✅ YES</td><td class='good'>OK</td></tr>";
        } elseif ($usesDatabase && $hasGetDb) {
            echo "<tr><td>{$endpoint}</td><td class='warning'>⚠️ MAYBE</td><td class='warning'>Uses getDb() but might be wrong context</td></tr>";
        } else {
            echo "<tr><td>{$endpoint}</td><td>-</td><td>No database usage detected</td></tr>";
        }
    } else {
        echo "<tr><td>{$endpoint}</td><td>-</td><td class='warning'>⚠️ Case not found</td></tr>";
    }
}

echo "</table>";

if (count($issues) > 0) {
    echo "<h2 class='bad'>❌ Issues Found!</h2>";
    echo "<p>The following endpoints are missing <code>\$db = getDb();</code>:</p>";
    echo "<ul>";
    foreach ($issues as $issue) {
        echo "<li class='bad'>{$issue}</li>";
    }
    echo "</ul>";
    echo "<p><strong>Fix:</strong> Add <code>\$db = getDb();</code> after the requireAdmin() or input validation, before any \$db-> or \$stmt usage.</p>";
} else {
    echo "<h2 class='good'>✅ All endpoints look good!</h2>";
}

// Check for calculateNextDue function
echo "<h2>Checking Helper Functions</h2>";
echo "<table>";
echo "<tr><th>Function</th><th>Status</th></tr>";

$configFile = __DIR__ . '/config/config.php';
if (file_exists($configFile)) {
    $configContent = file_get_contents($configFile);
    
    $hasCalculateNextDue = strpos($configContent, 'function calculateNextDue') !== false;
    $hasLogAudit = strpos($configContent, 'function logAudit') !== false;
    $hasGetDb = strpos($configContent, 'function getDb') !== false;
    
    echo "<tr><td>getDb()</td><td class='" . ($hasGetDb ? "good'>✅ Found" : "bad'>❌ NOT FOUND") . "</td></tr>";
    echo "<tr><td>calculateNextDue()</td><td class='" . ($hasCalculateNextDue ? "good'>✅ Found" : "bad'>❌ NOT FOUND - THIS IS CRITICAL") . "</td></tr>";
    echo "<tr><td>logAudit()</td><td class='" . ($hasLogAudit ? "good'>✅ Found" : "warning'>⚠️ Not found (optional)") . "</td></tr>";
    
    if (!$hasCalculateNextDue) {
        echo "</table>";
        echo "<h3 class='bad'>❌ CRITICAL: Missing calculateNextDue() function!</h3>";
        echo "<p>Add this to your <code>config/config.php</code> file:</p>";
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
} else {
    echo "<tr><td colspan='2' class='bad'>❌ config/config.php not found!</td></tr>";
}

echo "</table>";

// Check for syntax errors
echo "<h2>Checking for Syntax Errors</h2>";
$output = [];
$returnCode = 0;
exec("php -l " . escapeshellarg($apiFile) . " 2>&1", $output, $returnCode);

if ($returnCode !== 0) {
    echo "<div class='bad'>";
    echo "<h3>❌ Syntax Error Found!</h3>";
    echo "<pre>" . implode("\n", $output) . "</pre>";
    echo "</div>";
} else {
    echo "<p class='good'>✅ No syntax errors detected</p>";
}

echo "<hr>";
echo "<h2>Summary</h2>";

if (count($issues) > 0) {
    echo "<p class='bad'><strong>Status: NEEDS FIXING</strong></p>";
    echo "<p>Fix the issues above, then run this script again to verify.</p>";
} else {
    echo "<p class='good'><strong>Status: LOOKS GOOD!</strong></p>";
    echo "<p>If you're still getting errors, run the diagnostic script: <a href='diagnose-admin-error.php'>diagnose-admin-error.php</a></p>";
}

echo "<hr>";
echo "<p><a href='admin/'>← Back to Admin Panel</a> | <a href='diagnose-admin-error.php'>Run Diagnostic →</a></p>";
?>
