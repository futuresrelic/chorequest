<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$versionFile = __DIR__ . '/../version.json';
echo file_get_contents($versionFile);
?>