<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config/config.php';

header('Content-Type: text/html; charset=utf-8');

echo "<h1>Test Admin Login API</h1>";

// Test the login directly
$email = 'admin@example.com';
$password = 'changeme';

echo "<h3>Testing login with: $email / $password</h3>";

$db = getDb();
$stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND role = 'admin'");
$stmt->execute([$email]);
$admin = $stmt->fetch();

if ($admin) {
    echo "<p>✅ Admin found in database</p>";
    echo "<pre>" . print_r($admin, true) . "</pre>";
    
    if (password_verify($password, $admin['password_hash'])) {
        echo "<p>✅ Password verified!</p>";
        
        // Test session
        startSession();
        $_SESSION['admin_id'] = $admin['id'];
        $_SESSION['admin_email'] = $admin['email'];
        
        echo "<p>✅ Session set</p>";
        echo "<pre>" . print_r($_SESSION, true) . "</pre>";
    } else {
        echo "<p>❌ Password verification failed</p>";
    }
} else {
    echo "<p>❌ Admin not found</p>";
}

echo "<hr>";
echo "<h3>Now test via API:</h3>";
echo "<p>Open browser console and run:</p>";
echo "<code>fetch('/api/api.php', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'admin_login', email: 'admin@example.com', password: 'changeme'})}).then(r => r.json()).then(console.log)</code>";
?>