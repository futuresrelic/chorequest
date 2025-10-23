<?php
require_once 'config/config.php';
$db = getDb();
$cols = $db->query("PRAGMA table_info(users)")->fetchAll();
echo "<pre>";
foreach($cols as $col) echo $col['name'] . "\n";