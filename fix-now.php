<?php
$dbPath = __DIR__ . '/data/app.sqlite';
$db = new PDO('sqlite:' . $dbPath);

// Clear everything
$db->exec("DELETE FROM rate_limits");
$db->exec("DELETE FROM devices");

// Reset admin password
$hash = password_hash('admin', PASSWORD_DEFAULT);
$db->exec("UPDATE users SET password_hash = '$hash' WHERE email = 'admin@example.com'");

// Generate fresh pairing code
$db->exec("INSERT INTO devices (kid_user_id, pairing_code) VALUES (2, 'TEST99')");

// Clear sessions
$sessionDir = __DIR__ . '/data/sessions';
if (is_dir($sessionDir)) {
    array_map('unlink', glob("$sessionDir/*"));
}

echo "<h1>FIXED!</h1>";
echo "<p>Admin login: admin@example.com / admin</p>";
echo "<p>Kid pairing code: <strong>TEST99</strong></p>";
echo "<p><a href='admin/'>Admin Panel</a></p>";
echo "<p><a href='kid/simple.html'>Kid Panel</a></p>";
echo "<br><strong>DELETE fix-now.php NOW!</strong>";
?>