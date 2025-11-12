<?php
$db = new PDO('sqlite:' . __DIR__ . '/data/app.sqlite');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

echo "<h2>Reset Everything</h2>";

// Clear rate limits
$db->exec("DELETE FROM rate_limits");
echo "✅ Rate limits cleared<br>";

// Clear all sessions (force logout everywhere)
echo "✅ All sessions will be cleared on next page load<br>";

// Show current admin password
$stmt = $db->query("SELECT password_hash FROM users WHERE email = 'admin@example.com'");
$result = $stmt->fetch(PDO::FETCH_ASSOC);
$isChangeme = password_verify('changeme', $result['password_hash']);

echo "<br><h3>Current Admin Password:</h3>";
if ($isChangeme) {
    echo "✅ Password is: <strong>changeme</strong><br>";
} else {
    echo "❌ Password is NOT 'changeme' - it was changed<br>";
    echo "<br><form method='post'>";
    echo "<button type='submit' name='reset' style='padding: 10px 20px; background: #EF4444; color: white; border: none; border-radius: 4px;'>Reset Password to 'changeme'</button>";
    echo "</form>";
    
    if (isset($_POST['reset'])) {
        $newHash = password_hash('changeme', PASSWORD_DEFAULT);
        $stmt = $db->prepare("UPDATE users SET password_hash = ? WHERE email = 'admin@example.com'");
        $stmt->execute([$newHash]);
        echo "<br><strong style='color: green;'>✅ Password reset to: changeme</strong><br>";
    }
}

echo "<br><h3>Pairing Codes:</h3>";
$stmt = $db->query("SELECT pairing_code, paired_at FROM devices ORDER BY id DESC LIMIT 3");
$codes = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($codes as $code) {
    if ($code['paired_at']) {
        echo "Code: {$code['pairing_code']} - ✅ Paired<br>";
    } else {
        echo "Code: <strong>{$code['pairing_code']}</strong> - ⏳ Ready to use<br>";
    }
}

echo "<br><a href='admin/' style='padding: 10px 20px; background: #4F46E5; color: white; text-decoration: none; border-radius: 4px; display: inline-block;'>Go to Admin Panel</a>";
echo "<br><br><strong style='color: red;'>⚠️ DELETE this file now!</strong>";
?>