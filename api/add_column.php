<?php
// Enable error reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "<h2>Adding settings column to database...</h2>";

require_once 'config/config.php';

if (!$conn) {
    die("❌ Database connection failed: " . mysqli_connect_error());
}

echo "✅ Connected to database<br>";

// Check if column already exists
$check_sql = "SHOW COLUMNS FROM kids LIKE 'settings'";
$result = $conn->query($check_sql);

if ($result->num_rows > 0) {
    echo "ℹ️ Column 'settings' already exists!<br>";
} else {
    echo "Adding 'settings' column...<br>";
    
    // Add settings column
    $sql = "ALTER TABLE kids ADD COLUMN settings TEXT NULL";
    
    if ($conn->query($sql) === TRUE) {
        echo "✅ Column 'settings' added successfully!<br>";
    } else {
        echo "❌ Error: " . $conn->error . "<br>";
    }
}

$conn->close();

echo "<br><strong>Done! You can now delete this file.</strong>";
?>