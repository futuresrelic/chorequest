<?php
require_once __DIR__ . '/config/config.php';

echo "<h1>Adding Animation Support to Themes...</h1>";

$db = getDb();

// Add animation columns
$db->exec("ALTER TABLE themes ADD COLUMN has_animation INTEGER DEFAULT 0");
$db->exec("ALTER TABLE themes ADD COLUMN animation_type TEXT DEFAULT NULL");

echo "<p>✅ Animation columns added!</p>";

// Update themes with animations
$animations = [
    'Space' => 'stars',
    'Ocean' => 'bubbles',
    'Arctic' => 'snowflakes',
    'Lava' => 'embers',
    'Rainbow' => 'sparkles'
];

foreach ($animations as $themeName => $animationType) {
    $stmt = $db->prepare("UPDATE themes SET has_animation = 1, animation_type = ? WHERE name = ?");
    $stmt->execute([$animationType, $themeName]);
    echo "<p>✅ Added {$animationType} animation to {$themeName} theme</p>";
}

echo "<hr>";
echo "<p><strong>Done! Delete this file now.</strong></p>";
echo "<p><a href='admin/'>Go to Admin Panel</a></p>";
?>