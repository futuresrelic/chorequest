<?php
// Read PHP error log
// Upload to: tasks.futuresrelic.com/check-errors.php

$errorLog = ini_get('error_log');
echo "<h1>PHP Error Log Location</h1>";
echo "<p>$errorLog</p>";

// Try common locations
$locations = [
    __DIR__ . '/error_log',
    __DIR__ . '/../error_log',
    '/home/dh_pznb2a/tasks.futuresrelic.com/error_log',
    '/home/dh_pznb2a/error_log'
];

foreach ($locations as $path) {
    if (file_exists($path)) {
        echo "<h2>Found: $path</h2>";
        echo "<pre style='background:#f5f5f5;padding:10px;overflow:auto;max-height:400px;'>";
        echo htmlspecialchars(file_get_contents($path));
        echo "</pre>";
    }
}

// Check data directory
if (file_exists(__DIR__ . '/data')) {
    echo "<h2>Files in /data:</h2>";
    print_r(scandir(__DIR__ . '/data'));
}
?>