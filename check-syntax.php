<?php
$file = __DIR__ . '/api/api.php';
$output = [];
$return = 0;

exec("php -l $file 2>&1", $output, $return);

echo "<h1>PHP Syntax Check</h1>";
echo "<h3>File: api/api.php</h3>";

if ($return === 0) {
    echo "<p style='color: green;'>✅ No syntax errors</p>";
} else {
    echo "<p style='color: red;'>❌ Syntax errors found:</p>";
    echo "<pre>" . implode("\n", $output) . "</pre>";
}

// Also check for common issues
$content = file_get_contents($file);
$lines = explode("\n", $content);

echo "<h3>Checking for common issues:</h3>";

// Check for unclosed cases
preg_match_all('/case\s+[\'"](\w+)[\'"]:/', $content, $cases);
echo "<p>Found " . count($cases[0]) . " case statements</p>";

// Check for breaks
$breaks = substr_count($content, 'break;');
echo "<p>Found $breaks break statements</p>";

if (count($cases[0]) > $breaks) {
    echo "<p style='color: orange;'>⚠️ Warning: More cases than breaks - possible missing break statement</p>";
}

// Find the admin_login case
$loginCaseStart = strpos($content, "case 'admin_login'");
if ($loginCaseStart) {
    $loginCaseEnd = strpos($content, 'break;', $loginCaseStart);
    $loginCase = substr($content, $loginCaseStart, $loginCaseEnd - $loginCaseStart + 6);
    
    echo "<h3>admin_login case:</h3>";
    echo "<pre>" . htmlspecialchars($loginCase) . "</pre>";
}
?>