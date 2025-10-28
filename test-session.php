<?php
session_start();

echo "<h1>Session Debug</h1>";

echo "<h3>All Session Variables:</h3>";
echo "<pre>";
print_r($_SESSION);
echo "</pre>";

echo "<h3>Specific Checks:</h3>";
echo "<p>kid_user_id: " . (isset($_SESSION['kid_user_id']) ? $_SESSION['kid_user_id'] : 'NOT SET') . "</p>";
echo "<p>kid_id: " . (isset($_SESSION['kid_id']) ? $_SESSION['kid_id'] : 'NOT SET') . "</p>";
echo "<p>user_id: " . (isset($_SESSION['user_id']) ? $_SESSION['user_id'] : 'NOT SET') . "</p>";

echo "<h3>Cookie Info:</h3>";
echo "<pre>";
print_r($_COOKIE);
echo "</pre>";
?>