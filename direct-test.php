<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config/config.php';

echo "<h1>Direct Completion Test</h1>";

$db = getDb();

// Get kid and chore
$stmt = $db->query("SELECT id FROM users WHERE role='kid' LIMIT 1");
$kidId = $stmt->fetchColumn();

$stmt = $db->query("SELECT chore_id FROM kid_chores WHERE kid_user_id = $kidId LIMIT 1");
$choreId = $stmt->fetchColumn();

echo "<p>Kid ID: $kidId, Chore ID: $choreId</p><hr>";

// Get chore details (what api.php does)
$stmt = $db->prepare("
    SELECT kc.*, c.requires_approval, c.default_points, c.recurrence_type
    FROM kid_chores kc
    JOIN chores c ON kc.chore_id = c.id
    WHERE kc.kid_user_id = ? AND kc.chore_id = ?
");
$stmt->execute([$kidId, $choreId]);
$kidChore = $stmt->fetch();

echo "<pre>Chore data:\n";
print_r($kidChore);
echo "</pre>";

// Try to call the function
try {
    require_once __DIR__ . '/api/api.php';
    
    $nextDue = calculateNextDueAfterCompletion($kidChore['recurrence_type']);
    echo "<p style='color:green;'>✅ Function worked! Next due: $nextDue</p>";
    
} catch (Throwable $e) {
    echo "<p style='color:red;'>❌ ERROR: " . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
}
?>