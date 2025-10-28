<?php
require_once __DIR__ . '/config/config.php';

echo "<h1>Setting up Themes Table...</h1>";

$db = getDb();

// Create themes table
$db->exec("
CREATE TABLE IF NOT EXISTS themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    bg_color TEXT DEFAULT '#4F46E5',
    bg_gradient TEXT DEFAULT 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)',
    text_color TEXT DEFAULT '#FFFFFF',
    accent_color TEXT DEFAULT '#818CF8',
    border_style TEXT DEFAULT 'solid',
    border_width TEXT DEFAULT '3px',
    border_radius TEXT DEFAULT '15px',
    font_family TEXT DEFAULT 'Quicksand',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
");

echo "<p>✅ Themes table created!</p>";
echo "<p><a href='admin/'>Go to Admin Panel</a></p>";
?>