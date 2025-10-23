<?php
// Show actual PHP error when completing chore
// Upload to: tasks.futuresrelic.com/test-complete.php

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config/config.php';

startSession();

// Fake kid session
$db = getDb();
$stmt = $db->query("SELECT id, kid_name FROM users WHERE role='kid' LIMIT 1");
$kid = $stmt->fetch();

$_SESSION['kid_token'] = 'test';

// Get a chore
$stmt = $db->query("SELECT chore_id FROM kid_chores WHERE kid_user_id = {$kid['id']} LIMIT 1");
$chore = $stmt->fetch();

// Simulate the completion
$_SERVER['REQUEST_METHOD'] = 'POST';
file_put_contents('php://input', json_encode([
    'action' => 'submit_chore_completion',
    'chore_id' => $chore['chore_id']
]));

echo "<h1>Testing Chore Completion</h1>";
echo "<p>Kid: {$kid['kid_name']}</p>";
echo "<p>Chore ID: {$chore['chore_id']}</p>";
echo "<hr>";

// Include api.php and see what happens
include __DIR__ . '/api/api.php';
?>