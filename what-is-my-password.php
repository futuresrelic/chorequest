<?php
$db = new PDO('sqlite:' . __DIR__ . '/data/app.sqlite');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

echo "<h2>Admin Password Check</h2>";

$stmt = $db->query("SELECT password_hash FROM users WHERE email = 'admin@example.com'");
$result = $stmt->fetch(PDO::FETCH_ASSOC);

if ($result) {
    $testPasswords = ['changeme', 'password123', 'admin123', 'test'];
    
    echo "<h3>Testing common passwords:</h3>";
    foreach ($testPasswords as $testPass) {
        $isValid = password_verify($testPass, $result['password_hash']);
        if ($isValid) {
            echo "✅ <strong style='color: green;'>'{$testPass}' WORKS!</strong><br>";
        } else {
            echo "❌ '{$testPass}' doesn't work<br>";
        }
    }
    
    echo "<br><h3>Set New Password:</h3>";
    echo "<form method='post'>";
    echo "<input type='text' name='newpass' placeholder='Enter new password' style='padding: 10px; font-size: 16px;'><br><br>";
    echo "<button type='submit' style='padding: 10px 20px; background: #4F46E5; color: white; border: none; border-radius: 4px; cursor: pointer;'>Set This Password</button>";
    echo "</form>";
    
    if (isset($_POST['newpass'])) {
        $newPass = $_POST['newpass'];
        $newHash = password_hash($newPass, PASSWORD_DEFAULT);
        $stmt = $db->prepare("UPDATE users SET password_hash = ? WHERE email = 'admin@example.com'");
        $stmt->execute([$newHash]);
        
        echo "<br><strong style='color: green;'>✅ Password changed to: {$newPass}</strong><br>";
        echo "Now try logging in with: admin@example.com / {$newPass}<br>";
    }
} else {
    echo "❌ Admin user not found!";
}

echo "<br><br><strong style='color: red;'>⚠️ DELETE this file immediately!</strong>";
?>