<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "Checking api.php for syntax errors...\n\n";

$output = [];
$return_var = 0;
exec('php -l ' . __DIR__ . '/api.php 2>&1', $output, $return_var);

echo implode("\n", $output);
echo "\n\nReturn code: " . $return_var;
echo "\n(0 = no errors, non-zero = syntax error)";
