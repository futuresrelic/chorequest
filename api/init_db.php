<?php
define('DB_PATH', __DIR__ . '/../data/app.sqlite');

try {
    $db = new PDO('sqlite:' . DB_PATH);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $schema = file_get_contents(__DIR__ . '/schema.sql');
    $db->exec($schema);
    
    // Database initialized successfully - no output needed
} catch (PDOException $e) {
    error_log('Database initialization failed: ' . $e->getMessage());
    // Don't output anything - let the calling code handle it
}
?>