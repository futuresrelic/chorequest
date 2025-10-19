<?php
$versionFile = __DIR__ . '/version.json';
$version = json_decode(file_get_contents($versionFile), true);

// Increment version
$parts = explode('.', $version['version']);
$parts[2]++; // Increment patch version
$newVersion = implode('.', $parts);

// Update file
$version['version'] = $newVersion;
$version['timestamp'] = time();

file_put_contents($versionFile, json_encode($version, JSON_PRETTY_PRINT));

echo "<h1>Version Updated!</h1>";
echo "<p>New version: <strong>{$newVersion}</strong></p>";
echo "<p>Timestamp: {$version['timestamp']}</p>";
echo "<hr>";
echo "<p><a href='admin/'>Admin Panel</a> | <a href='kid/'>Kid Panel</a></p>";
?>