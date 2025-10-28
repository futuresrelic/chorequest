<?php
require_once __DIR__ . '/config/config.php';

echo "<h1>Adding Advanced CSS Controls to Themes...</h1>";

$db = getDb();

// Add new CSS control columns
$db->exec("ALTER TABLE themes ADD COLUMN card_bg_color TEXT DEFAULT '#FFFFFF'");
$db->exec("ALTER TABLE themes ADD COLUMN card_opacity REAL DEFAULT 0.95");
$db->exec("ALTER TABLE themes ADD COLUMN card_blur INTEGER DEFAULT 10");
$db->exec("ALTER TABLE themes ADD COLUMN card_shadow TEXT DEFAULT '0 8px 32px rgba(0,0,0,0.1)'");
$db->exec("ALTER TABLE themes ADD COLUMN header_bg_color TEXT DEFAULT '#FFFFFF'");
$db->exec("ALTER TABLE themes ADD COLUMN header_opacity REAL DEFAULT 0.85");
$db->exec("ALTER TABLE themes ADD COLUMN header_blur INTEGER DEFAULT 20");
$db->exec("ALTER TABLE themes ADD COLUMN nav_bg_color TEXT DEFAULT '#FFFFFF'");
$db->exec("ALTER TABLE themes ADD COLUMN nav_opacity REAL DEFAULT 0.95");
$db->exec("ALTER TABLE themes ADD COLUMN nav_blur INTEGER DEFAULT 20");
$db->exec("ALTER TABLE themes ADD COLUMN button_gradient TEXT DEFAULT NULL");

echo "<p>✅ Advanced CSS columns added!</p>";

// Set defaults for existing themes
$db->exec("UPDATE themes SET card_bg_color = '#FFFFFF' WHERE card_bg_color IS NULL");
$db->exec("UPDATE themes SET card_opacity = 0.95 WHERE card_opacity IS NULL");
$db->exec("UPDATE themes SET card_blur = 10 WHERE card_blur IS NULL");

echo "<p>✅ Defaults applied to existing themes!</p>";
echo "<hr>";
echo "<p><strong>Done! Delete this file now.</strong></p>";
echo "<p><a href='admin/'>Go to Admin Panel</a></p>";
?>