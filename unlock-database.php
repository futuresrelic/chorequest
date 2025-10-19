<?php
$dbPath = __DIR__ . '/data/app.sqlite';

// Close all connections
$db = new PDO('sqlite:' . $dbPath);
$db->exec('PRAGMA journal_mode = DELETE');  // Switch off WAL temporarily
$db = null;

// Reconnect with WAL
$db = new PDO('sqlite:' . $dbPath);
$db->exec('PRAGMA journal_mode = WAL');
$db->exec('PRAGMA busy_timeout = 10000');
$db = null;

// Delete lock files if they exist
@unlink($dbPath . '-shm');
@unlink($dbPath . '-wal');

echo "<h1>Database Unlocked!</h1>";
echo "<p>✅ Lock files cleared</p>";
echo "<p>✅ WAL mode enabled</p>";
echo "<p><a href='admin/'>Try Admin Panel</a></p>";
?>