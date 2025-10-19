<?php
$dbPath = __DIR__ . '/data/app.sqlite';
$backupPath = __DIR__ . '/data/backup-' . date('Y-m-d-His') . '.sqlite';

if (copy($dbPath, $backupPath)) {
    // Force download
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . basename($backupPath) . '"');
    header('Content-Length: ' . filesize($backupPath));
    readfile($backupPath);
    unlink($backupPath); // Delete temp backup
} else {
    echo "Backup failed!";
}
?>