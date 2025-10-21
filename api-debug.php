<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>API Debug - Finding the 500 Error</h1>";

// Test if api.php has syntax errors
$apiFile = __DIR__ . '/api/api.php';
echo "<h2>Checking API File Syntax...</h2>";

$output = [];
$returnCode = 0;
exec("php -l " . escapeshellarg($apiFile) . " 2>&1", $output, $returnCode);

if ($returnCode !== 0) {
    echo "<div style='background: #fee; padding: 20px; border-radius: 8px;'>";
    echo "<h3 style='color: red;'>❌ Syntax Error Found!</h3>";
    echo "<pre>" . implode("\n", $output) . "</pre>";
    echo "</div>";
} else {
    echo "<p style='color: green;'>✓ No syntax errors detected</p>";
}

// Check for duplicate case statements
echo "<h2>Checking for Duplicate Cases...</h2>";
$content = file_get_contents($apiFile);

$cases = [
    'load_chore_presets',
    'install_preset_category', 
    'install_preset_rewards'
];

foreach ($cases as $case) {
    $pattern = "/case\s+['\"]" . $case . "['\"]\s*:/";
    preg_match_all($pattern, $content, $matches);
    $count = count($matches[0]);
    
    if ($count > 1) {
        echo "<p style='color: red;'>❌ Found $count copies of: case '$case'</p>";
    } else if ($count === 1) {
        echo "<p style='color: green;'>✓ Found exactly 1 copy of: case '$case'</p>";
    } else {
        echo "<p style='color: orange;'>⚠ Missing: case '$case'</p>";
    }
}

// Try to actually call the API
echo "<h2>Testing API Call...</h2>";

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['action'] = 'load_chore_presets';

echo "<p>Attempting to load presets...</p>";

ob_start();
try {
    include $apiFile;
    $response = ob_get_clean();
    echo "<p style='color: green;'>✓ API executed without fatal error</p>";
    echo "<pre>" . htmlspecialchars($response) . "</pre>";
} catch (Throwable $e) {
    ob_end_clean();
    echo "<div style='background: #fee; padding: 20px; border-radius: 8px; margin: 20px 0;'>";
    echo "<h3 style='color: red;'>❌ Fatal Error</h3>";
    echo "<p><strong>Message:</strong> " . $e->getMessage() . "</p>";
    echo "<p><strong>File:</strong> " . $e->getFile() . "</p>";
    echo "<p><strong>Line:</strong> " . $e->getLine() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
    echo "</div>";
}
?>