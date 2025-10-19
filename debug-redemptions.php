<?php
require_once __DIR__ . '/config/config.php';

header('Content-Type: text/html; charset=utf-8');

echo "<h1>Redemption Debug</h1>";

$db = getDb();

// Show all redemptions
echo "<h3>All Redemptions:</h3>";
$stmt = $db->query("
    SELECT r.*, u.kid_name, rw.title as reward_title, rw.cost_points
    FROM redemptions r
    JOIN users u ON r.kid_user_id = u.id
    JOIN rewards rw ON r.reward_id = rw.id
    ORDER BY r.requested_at DESC
");
$redemptions = $stmt->fetchAll();

if (empty($redemptions)) {
    echo "<p style='color: red;'>❌ NO REDEMPTIONS FOUND IN DATABASE</p>";
} else {
    echo "<table border='1' cellpadding='5'>";
    echo "<tr><th>ID</th><th>Kid</th><th>Reward</th><th>Cost</th><th>Status</th><th>Requested</th></tr>";
    foreach ($redemptions as $r) {
        echo "<tr>";
        echo "<td>{$r['id']}</td>";
        echo "<td>{$r['kid_name']}</td>";
        echo "<td>{$r['reward_title']}</td>";
        echo "<td>{$r['cost_points']}</td>";
        echo "<td>{$r['status']}</td>";
        echo "<td>{$r['requested_at']}</td>";
        echo "</tr>";
    }
    echo "</table>";
}

// Show kid's current points
echo "<h3>Kids Points:</h3>";
$stmt = $db->query("SELECT id, kid_name, total_points FROM users WHERE role = 'kid'");
$kids = $stmt->fetchAll();
echo "<table border='1' cellpadding='5'>";
echo "<tr><th>Kid</th><th>Points</th></tr>";
foreach ($kids as $k) {
    echo "<tr><td>{$k['kid_name']}</td><td>{$k['total_points']}</td></tr>";
}
echo "</table>";

// Show available rewards
echo "<h3>Available Rewards:</h3>";
$stmt = $db->query("SELECT * FROM rewards WHERE is_active = 1");
$rewards = $stmt->fetchAll();
echo "<table border='1' cellpadding='5'>";
echo "<tr><th>ID</th><th>Title</th><th>Cost</th><th>Active</th></tr>";
foreach ($rewards as $rw) {
    echo "<tr><td>{$rw['id']}</td><td>{$rw['title']}</td><td>{$rw['cost_points']}</td><td>{$rw['is_active']}</td></tr>";
}
echo "</table>";

echo "<hr>";
echo "<p><a href='admin/'>Admin Panel</a> | <a href='kid/'>Kid Panel</a></p>";
?>