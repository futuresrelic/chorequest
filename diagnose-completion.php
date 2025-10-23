<?php
/**
 * BETTER DIAGNOSTIC - Actually checks api.php file
 * 
 * Upload to: https://tasks.futuresrelic.com/diagnose-completion-v2.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<style>
body { font-family: system-ui; max-width: 900px; margin: 40px auto; padding: 0 20px; }
.error { background: #fee; padding: 20px; border-radius: 8px; color: #c00; }
.success { background: #efe; padding: 20px; border-radius: 8px; color: #060; }
.warning { background: #fff4e5; padding: 20px; border-radius: 8px; color: #f57c00; }
pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
</style>";

echo "<h1>🔍 Chore Completion Diagnostic v2</h1>";

$apiPath = __DIR__ . '/api/api.php';

// Check if api.php exists
echo "<h2>Step 1: Check if api.php exists</h2>";

if (!file_exists($apiPath)) {
    echo "<div class='error'>";
    echo "<h3>❌ api.php NOT FOUND!</h3>";
    echo "<p>File does not exist at: <code>{$apiPath}</code></p>";
    echo "<p><strong>This is your problem!</strong> The API file is missing.</p>";
    
    // Check for backup
    if (file_exists(__DIR__ . '/api/api.phpOLD')) {
        echo "<p style='color: orange;'>⚠️ Found api.phpOLD - did you rename it for testing?</p>";
        echo "<p><strong>Fix:</strong> Rename api.phpOLD back to api.php</p>";
    }
    
    echo "</div>";
    exit;
}

echo "<p style='color: green;'>✅ api.php exists</p>";

// Check if we can read it
echo "<h2>Step 2: Read api.php file</h2>";

$apiContent = file_get_contents($apiPath);

if ($apiContent === false) {
    echo "<div class='error'>";
    echo "<p>❌ Cannot read api.php file (permissions issue?)</p>";
    echo "</div>";
    exit;
}

$lineCount = substr_count($apiContent, "\n");
$sizeKB = number_format(strlen($apiContent) / 1024, 2);

echo "<p style='color: green;'>✅ File readable</p>";
echo "<p>File size: {$sizeKB} KB ({$lineCount} lines)</p>";

// Check for the function in the file
echo "<h2>Step 3: Search for calculateNextDueAfterCompletion() function</h2>";

if (strpos($apiContent, 'function calculateNextDueAfterCompletion') !== false) {
    echo "<p style='color: green;'>✅ Function definition FOUND in api.php!</p>";
    
    // Find the exact line
    $lines = explode("\n", $apiContent);
    foreach ($lines as $lineNum => $line) {
        if (strpos($line, 'function calculateNextDueAfterCompletion') !== false) {
            $actualLine = $lineNum + 1;
            echo "<p>Function is on line: <strong>{$actualLine}</strong></p>";
            
            // Show surrounding code
            echo "<h3>Code context:</h3>";
            echo "<pre>";
            $start = max(0, $lineNum - 3);
            $end = min(count($lines), $lineNum + 15);
            
            for ($i = $start; $i < $end; $i++) {
                $displayLine = $i + 1;
                $marker = ($i === $lineNum) ? '>>> ' : '    ';
                echo htmlspecialchars(sprintf("%s%4d: %s\n", $marker, $displayLine, $lines[$i]));
            }
            echo "</pre>";
            break;
        }
    }
} else {
    echo "<div class='error'>";
    echo "<h3>❌ FUNCTION NOT FOUND!</h3>";
    echo "<p>The function <code>calculateNextDueAfterCompletion()</code> does not exist in api.php</p>";
    echo "<p><strong>This is your problem!</strong></p>";
    echo "</div>";
    
    // Show what we need to add
    echo "<h3>Add this to api.php (after line ~120):</h3>";
    echo "<pre>";
    echo htmlspecialchars('
function calculateNextDueAfterCompletion($recurrenceType) {
    switch ($recurrenceType) {
        case \'daily\':
            return date(\'Y-m-d H:i:s\', strtotime(\'+1 day\'));
        case \'weekly\':
            return date(\'Y-m-d H:i:s\', strtotime(\'+1 week\'));
        case \'monthly\':
            return date(\'Y-m-d H:i:s\', strtotime(\'+1 month\'));
        case \'once\':
            return null;
        default:
            return date(\'Y-m-d H:i:s\', strtotime(\'+1 day\'));
    }
}
');
    echo "</pre>";
    exit;
}

// Check if submit_chore_completion case uses it
echo "<h2>Step 4: Check if submit_chore_completion uses the function</h2>";

if (strpos($apiContent, 'case \'submit_chore_completion\'') === false) {
    echo "<div class='error'>";
    echo "<p>❌ submit_chore_completion case NOT FOUND in api.php!</p>";
    echo "</div>";
} else {
    echo "<p style='color: green;'>✅ submit_chore_completion case exists</p>";
    
    // Find if it calls the function
    $submitStart = strpos($apiContent, 'case \'submit_chore_completion\'');
    $nextCase = strpos($apiContent, 'case \'', $submitStart + 10);
    if ($nextCase === false) $nextCase = strlen($apiContent);
    
    $submitBlock = substr($apiContent, $submitStart, $nextCase - $submitStart);
    
    if (strpos($submitBlock, 'calculateNextDueAfterCompletion') !== false) {
        echo "<p style='color: green;'>✅ Function IS called in submit_chore_completion</p>";
    } else {
        echo "<div class='warning'>";
        echo "<h3>⚠️ Function NOT called in submit_chore_completion!</h3>";
        echo "<p>The function exists, but submit_chore_completion isn't using it.</p>";
        echo "<p>Look for this line and change it:</p>";
        echo "<pre>// WRONG\n\$nextDue = calculateNextDue(\$kidChore['recurrence_type']);\n\n// CORRECT\n\$nextDue = calculateNextDueAfterCompletion(\$kidChore['recurrence_type']);</pre>";
        echo "</div>";
    }
}

// Check for syntax errors
echo "<h2>Step 5: Syntax Check</h2>";

$output = [];
$returnCode = 0;
exec("php -l " . escapeshellarg($apiPath) . " 2>&1", $output, $returnCode);

if ($returnCode !== 0) {
    echo "<div class='error'>";
    echo "<h3>❌ SYNTAX ERROR IN API.PHP!</h3>";
    echo "<pre>" . implode("\n", $output) . "</pre>";
    echo "</div>";
} else {
    echo "<p style='color: green;'>✅ No syntax errors detected</p>";
}

// Try to actually test it
echo "<h2>Step 6: Test API Response</h2>";

require_once __DIR__ . '/config/config.php';

try {
    $db = getDb();
    
    // Get a test chore
    $stmt = $db->query("
        SELECT u.id as kid_id, kc.chore_id, c.title
        FROM users u
        JOIN kid_chores kc ON u.id = kc.kid_user_id
        JOIN chores c ON kc.chore_id = c.id
        LIMIT 1
    ");
    $test = $stmt->fetch();
    
    if ($test) {
        echo "<p>Testing with kid ID {$test['kid_id']}, chore: {$test['title']}</p>";
        
        // Simulate the API call
        echo "<h3>Simulating completion API call...</h3>";
        echo "<p>This would normally call submit_chore_completion</p>";
        
        // Check if we can simulate it
        echo "<div class='warning'>";
        echo "<p><strong>To fully test:</strong> Try completing the chore in the kid app</p>";
        echo "<p>If it still fails, check the browser console for the exact error</p>";
        echo "</div>";
    } else {
        echo "<p>No assigned chores found to test with</p>";
    }
    
} catch (Exception $e) {
    echo "<div class='error'>";
    echo "<p>Database error: " . $e->getMessage() . "</p>";
    echo "</div>";
}

echo "<hr>";
echo "<h2>✅ Diagnostic Summary</h2>";

$allGood = (
    file_exists($apiPath) &&
    strpos($apiContent, 'function calculateNextDueAfterCompletion') !== false &&
    strpos($apiContent, 'case \'submit_chore_completion\'') !== false &&
    $returnCode === 0
);

if ($allGood) {
    echo "<div class='success'>";
    echo "<h3>🎉 Everything looks good!</h3>";
    echo "<p>If chore completion still fails:</p>";
    echo "<ol>";
    echo "<li>Clear your browser cache (Ctrl+Shift+Delete)</li>";
    echo "<li>Hard refresh (Ctrl+Shift+R)</li>";
    echo "<li>Check browser console for JavaScript errors</li>";
    echo "<li>Try completing a chore and look at the Network tab for the API response</li>";
    echo "</ol>";
    echo "</div>";
} else {
    echo "<div class='error'>";
    echo "<p>Fix the issues above and run this diagnostic again.</p>";
    echo "</div>";
}

echo "<br>";
echo "<p><a href='kid/'>Go to Kid App →</a> | <a href='admin/'>Admin Panel →</a></p>";
?>