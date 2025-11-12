<?php
header('Content-Type: text/html; charset=utf-8');

echo "<h1>Cookie Debug</h1>";

// Show all cookies
echo "<h3>Current Cookies:</h3>";
echo "<pre>" . print_r($_COOKIE, true) . "</pre>";

// Try to set a test cookie - SIMPLE VERSION
setcookie('test_cookie', 'test_value_' . time(), time() + 3600, '/', '', true, true);

echo "<h3>Test cookie set. <a href='test-cookie.php'>Refresh this page</a></h3>";

if (isset($_COOKIE['test_cookie'])) {
    echo "<p style='color: green;'>✅ Test cookie IS working: " . $_COOKIE['test_cookie'] . "</p>";
} else {
    echo "<p style='color: red;'>❌ Test cookie NOT working</p>";
}

// Check kid_token specifically
if (isset($_COOKIE['kid_token'])) {
    echo "<h3>Kid Token Found:</h3>";
    echo "<p>Token: " . substr($_COOKIE['kid_token'], 0, 20) . "...</p>";
    
    // Verify in database
    require_once __DIR__ . '/config/config.php';
    $db = getDb();
    $stmt = $db->prepare("SELECT * FROM devices WHERE device_token = ?");
    $stmt->execute([$_COOKIE['kid_token']]);
    $device = $stmt->fetch();
    
    if ($device) {
        echo "<p style='color: green;'>✅ Token is VALID in database</p>";
        echo "<pre>" . print_r($device, true) . "</pre>";
    } else {
        echo "<p style='color: red;'>❌ Token NOT FOUND in database</p>";
    }
} else {
    echo "<h3 style='color: red;'>❌ No kid_token cookie found</h3>";
}

echo "<hr>";
echo "<h3>Server Info:</h3>";
echo "Domain: " . $_SERVER['HTTP_HOST'] . "<br>";
echo "Path: " . $_SERVER['REQUEST_URI'] . "<br>";
echo "HTTPS: " . (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'Yes' : 'No') . "<br>";
echo "PHP Version: " . phpversion() . "<br>";
?>