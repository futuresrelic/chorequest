<?php
/**
 * PHP SYNTAX CHECKER
 * 
 * This will show you the EXACT syntax error in your api.php
 * Upload to: https://tasks.futuresrelic.com/syntax-check.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<style>
body { font-family: system-ui; max-width: 900px; margin: 40px auto; padding: 0 20px; }
.error { background: #fee; padding: 20px; border-radius: 8px; color: #c00; }
.success { background: #efe; padding: 20px; border-radius: 8px; color: #060; }
pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
</style>";

echo "<h1>🔍 PHP Syntax Checker</h1>";

$apiFile = __DIR__ . '/api/api.php';

if (!file_exists($apiFile)) {
    echo "<div class='error'>";
    echo "<h2>❌ File Not Found</h2>";
    echo "<p>Cannot find: {$apiFile}</p>";
    echo "</div>";
    exit;
}

echo "<h2>Checking api/api.php for syntax errors...</h2>";

// Method 1: PHP lint check
$output = [];
$returnCode = 0;
exec("php -l " . escapeshellarg($apiFile) . " 2>&1", $output, $returnCode);

if ($returnCode !== 0) {
    echo "<div class='error'>";
    echo "<h2>❌ SYNTAX ERROR FOUND!</h2>";
    echo "<pre>" . implode("\n", $output) . "</pre>";
    echo "</div>";
    
    // Try to extract line number
    $errorText = implode("\n", $output);
    if (preg_match('/on line (\d+)/', $errorText, $matches)) {
        $lineNum = $matches[1];
        echo "<h3>Problem is on line {$lineNum}</h3>";
        
        // Show the problematic area
        $lines = file($apiFile);
        $start = max(0, $lineNum - 5);
        $end = min(count($lines), $lineNum + 5);
        
        echo "<h3>Code around line {$lineNum}:</h3>";
        echo "<pre>";
        for ($i = $start; $i < $end; $i++) {
            $currentLine = $i + 1;
            $marker = ($currentLine == $lineNum) ? '>>> ' : '    ';
            $style = ($currentLine == $lineNum) ? 'background: #fdd;' : '';
            echo "<span style='{$style}'>{$marker}{$currentLine}: " . htmlspecialchars($lines[$i]) . "</span>";
        }
        echo "</pre>";
        
        echo "<h3>Common Fixes:</h3>";
        echo "<ul>";
        echo "<li>Missing semicolon <code>;</code> at end of previous line</li>";
        echo "<li>Unmatched brackets <code>{</code> or <code>}</code></li>";
        echo "<li>Unmatched parentheses <code>(</code> or <code>)</code></li>";
        echo "<li>Missing quote <code>'</code> or <code>\"</code></li>";
        echo "<li>Typo in variable name (check \$chore vs \$chores)</li>";
        echo "</ul>";
    }
    
    exit;
}

echo "<div class='success'>";
echo "<h2>✅ No Syntax Errors!</h2>";
echo "<p>Your api.php has valid PHP syntax.</p>";
echo "</div>";

// Method 2: Try to actually include and catch runtime errors
echo "<h2>Checking for runtime errors...</h2>";

// Capture any output
ob_start();
try {
    // Set up minimal environment
    $_SERVER['REQUEST_METHOD'] = 'GET';
    
    // Try to include the file
    include $apiFile;
    
    $output = ob_get_clean();
    
    if (!empty($output)) {
        echo "<div class='error'>";
        echo "<h3>⚠️ Unexpected Output</h3>";
        echo "<p>The api.php file is producing output when it shouldn't. This could be your problem:</p>";
        echo "<pre>" . htmlspecialchars($output) . "</pre>";
        echo "</div>";
    } else {
        echo "<div class='success'>";
        echo "<p>✅ No unexpected output</p>";
        echo "</div>";
    }
    
} catch (Throwable $e) {
    ob_end_clean();
    
    echo "<div class='error'>";
    echo "<h2>❌ Runtime Error Found!</h2>";
    echo "<p><strong>Error:</strong> " . $e->getMessage() . "</p>";
    echo "<p><strong>File:</strong> " . $e->getFile() . "</p>";
    echo "<p><strong>Line:</strong> " . $e->getLine() . "</p>";
    echo "<h3>Stack Trace:</h3>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
    echo "</div>";
}

// Method 3: Check for common mistakes
echo "<h2>Checking for common issues...</h2>";

$content = file_get_contents($apiFile);

$issues = [];

// Check for echo/print statements (shouldn't be in API)
if (preg_match('/\b(echo|print)\s+/', $content, $matches, PREG_OFFSET_CAPTURE)) {
    $line = substr_count(substr($content, 0, $matches[0][1]), "\n") + 1;
    $issues[] = "Found '{$matches[0][0]}' on line ~{$line} - API files shouldn't output directly, use jsonResponse() instead";
}

// Check for unclosed strings
$singleQuotes = substr_count($content, "'");
$doubleQuotes = substr_count($content, '"');

if ($singleQuotes % 2 !== 0) {
    $issues[] = "Unmatched single quotes (') detected - you might have an unclosed string";
}

if ($doubleQuotes % 2 !== 0) {
    $issues[] = "Unmatched double quotes (\") detected - you might have an unclosed string";
}

// Check for common typos
if (preg_match('/\$chore\[\'frequency\'\]/', $content)) {
    $issues[] = "Still using \$chore['frequency'] - should be \$chore['recurrence_type']";
}

if (preg_match('/SELECT.*frequency.*FROM chores/', $content)) {
    $issues[] = "Still selecting 'frequency' column - should be 'recurrence_type'";
}

// Check for broken SQL
if (preg_match('/SELECT.*,\s*FROM/', $content)) {
    $issues[] = "SQL syntax error: comma before FROM";
}

if (!empty($issues)) {
    echo "<div class='error'>";
    echo "<h3>⚠️ Potential Issues Found:</h3>";
    echo "<ul>";
    foreach ($issues as $issue) {
        echo "<li>{$issue}</li>";
    }
    echo "</ul>";
    echo "</div>";
} else {
    echo "<div class='success'>";
    echo "<p>✅ No common issues detected</p>";
    echo "</div>";
}

echo "<hr>";
echo "<h2>Next Steps:</h2>";

if ($returnCode === 0 && empty($issues)) {
    echo "<div class='success'>";
    echo "<p><strong>Your api.php syntax looks good!</strong></p>";
    echo "<p>The error might be coming from:</p>";
    echo "<ul>";
    echo "<li>config/config.php - check this file for syntax errors too</li>";
    echo "<li>A PHP warning/notice being output before JSON</li>";
    echo "<li>Missing or incorrect jsonResponse() calls</li>";
    echo "</ul>";
    echo "<p><a href='check-config.php'>Check config.php syntax →</a></p>";
    echo "</div>";
} else {
    echo "<p>Fix the errors shown above, then refresh the admin panel.</p>";
}

echo "<hr>";
echo "<p><a href='admin/'>← Back to Admin Panel</a></p>";
?>
