<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');

echo json_encode([
    'ok' => true,
    'message' => 'API is responding',
    'php_version' => phpversion(),
    'time' => date('Y-m-d H:i:s')
]);
?>