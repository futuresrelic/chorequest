<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Testing API</h1>";

// Test 1: Can we load config?
echo "<h3>Test 1: Load Config</h3>";
try {
    require_once __DIR__ . '/config/config.php';
    echo "✅ Config loaded<br>";
} catch (Exception $e) {
    echo "❌ Config failed: " . $e->getMessage() . "<br>";
    die();
}

// Test 2: Can we connect to database?
echo "<h3>Test 2: Database Connection</h3>";
try {
    $db = getDb();
    echo "✅ Database connected<br>";
} catch (Exception $e) {
    echo "❌ Database failed: " . $e->getMessage() . "<br>";
    die();
}

// Test 3: Can we start session?
echo "<h3>Test 3: Session</h3>";
try {
    startSession();
    echo "✅ Session started<br>";
    echo "Session ID: " . session_id() . "<br>";
} catch (Exception $e) {
    echo "❌ Session failed: " . $e->getMessage() . "<br>";
}

// Test 4: Does admin exist?
echo "<h3>Test 4: Admin User</h3>";
$stmt = $db->query("SELECT id, email FROM users WHERE role = 'admin'");
$admin = $stmt->fetch();
if ($admin) {
    echo "✅ Admin exists: " . $admin['email'] . "<br>";
    
    // Test password
    $stmt = $db->query("SELECT password_hash FROM users WHERE email = 'admin@example.com'");
    $row = $stmt->fetch();
    $testPass = 'changeme';
    $works = password_verify($testPass, $row['password_hash']);
    echo "Password '$testPass' works: " . ($works ? "✅ YES" : "❌ NO") . "<br>";
} else {
    echo "❌ No admin found<br>";
}

// Test 5: Test actual login
echo "<h3>Test 5: Simulate Login</h3>";
$email = 'admin@example.com';
$password = 'changeme';

$stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND role = 'admin'");
$stmt->execute([$email]);
$admin = $stmt->fetch();

if ($admin) {
    echo "Admin found: " . $admin['email'] . "<br>";
    if (password_verify($password, $admin['password_hash'])) {
        echo "✅ Password verified!<br>";
        $_SESSION['admin_id'] = $admin['id'];
        $_SESSION['admin_email'] = $admin['email'];
        echo "✅ Session set!<br>";
        echo "Session data: <pre>" . print_r($_SESSION, true) . "</pre>";
    } else {
        echo "❌ Password verify FAILED<br>";
    }
} else {
    echo "❌ Admin not found<br>";
}

echo "<br><strong>If all tests pass, the problem is in api.php</strong>";
?>