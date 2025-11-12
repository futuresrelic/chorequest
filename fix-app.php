<?php
// Emergency fix script - DELETE after use!

$dbPath = __DIR__ . '/data/app.sqlite';

try {
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "<h2>Emergency Fix</h2>";
    
    // Clear rate limits
    $db->exec("DELETE FROM rate_limits");
    echo "✅ Rate limits cleared<br>";
    
    // Show admin password
    $stmt = $db->query("SELECT password_hash FROM users WHERE email = 'admin@example.com'");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $isValid = password_verify('changeme', $result['password_hash']);
    echo "✅ Admin password 'changeme' is: " . ($isValid ? "VALID" : "INVALID") . "<br>";
    
    // Show pairing codes
    echo "<br><h3>Active Pairing Codes:</h3>";
    $stmt = $db->query("
        SELECT d.pairing_code, u.kid_name 
        FROM devices d
        JOIN users u ON d.kid_user_id = u.id
        WHERE d.paired_at IS NULL
        ORDER BY d.id DESC
        LIMIT 5
    ");
    $codes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($codes) > 0) {
        foreach ($codes as $code) {
            echo "Code: <strong>" . $code['pairing_code'] . "</strong> for " . $code['kid_name'] . "<br>";
        }
    } else {
        echo "No active pairing codes. Generate one from admin panel.<br>";
    }
    
    // Show paired devices
    echo "<br><h3>Paired Devices:</h3>";
    $stmt = $db->query("
        SELECT d.id, d.device_label, u.kid_name, d.device_token
        FROM devices d
        JOIN users u ON d.kid_user_id = u.id
        WHERE d.paired_at IS NOT NULL
        ORDER BY d.id DESC
    ");
    $devices = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($devices) > 0) {
        foreach ($devices as $device) {
            echo "Device: <strong>" . $device['device_label'] . "</strong> (" . $device['kid_name'] . ")<br>";
        }
        
        echo "<br><form method='post'>";
        echo "<button type='submit' name='unpair_all' style='padding: 10px 20px; background: #EF4444; color: white; border: none; border-radius: 8px; cursor: pointer;'>Unpair All Devices</button>";
        echo "</form>";
    } else {
        echo "No paired devices.<br>";
    }
    
    if (isset($_POST['unpair_all'])) {
        $db->exec("DELETE FROM devices WHERE paired_at IS NOT NULL");
        echo "<br><strong style='color: green;'>✅ All devices unpaired!</strong><br>";
    }
    
    echo "<br><hr>";
    echo "<h3>Next Steps:</h3>";
    echo "<ol>";
    echo "<li><a href='admin/'>Go to Admin Panel</a> - Login: admin@example.com / changeme</li>";
    echo "<li>Go to Kids tab → Click 'Get Code' to generate new pairing code</li>";
    echo "<li><a href='kid/'>Go to Kid Panel</a> - Enter the pairing code</li>";
    echo "</ol>";
    
    echo "<br><strong style='color: red;'>⚠️ DELETE fix-app.php now!</strong>";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage();
}
?>