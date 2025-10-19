<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Generate App Icons from PNG</h1>";

function resizeWithTransparency($sourcePath, $outputPath, $newWidth, $newHeight) {
    // Get source image info
    $sourceInfo = getimagesize($sourcePath);
    $sourceWidth = $sourceInfo[0];
    $sourceHeight = $sourceInfo[1];
    
    // Load source image
    $sourceImage = imagecreatefrompng($sourcePath);
    if (!$sourceImage) {
        return "Failed to load source image: $sourcePath";
    }
    
    // Create new image with transparency
    $newImage = imagecreatetruecolor($newWidth, $newHeight);
    
    // Enable transparency
    imagealphablending($newImage, false);
    imagesavealpha($newImage, true);
    
    // Fill with transparent background
    $transparent = imagecolorallocatealpha($newImage, 0, 0, 0, 127);
    imagefill($newImage, 0, 0, $transparent);
    
    // Copy and resize with transparency preservation
    imagealphablending($newImage, true);
    imagecopyresampled(
        $newImage, $sourceImage,
        0, 0, 0, 0,
        $newWidth, $newHeight,
        $sourceWidth, $sourceHeight
    );
    
    // Save with full alpha channel
    imagesavealpha($newImage, true);
    imagepng($newImage, $outputPath, 9); // 9 = max compression
    
    // Clean up
    imagedestroy($sourceImage);
    imagedestroy($newImage);
    
    return true;
}

// Process Admin Icons
echo "<h2>Admin Icons</h2>";
$adminSource = __DIR__ . '/assets/admin-favicon.png';

if (file_exists($adminSource)) {
    $info = getimagesize($adminSource);
    echo "<p>Source: admin-favicon.png ({$info[0]}x{$info[1]})</p>";
    
    // Generate 192x192
    $result = resizeWithTransparency($adminSource, __DIR__ . '/assets/admin-icon-192.png', 192, 192);
    if ($result === true) {
        echo "<p>✅ Created admin-icon-192.png</p>";
    } else {
        echo "<p>❌ Error: $result</p>";
    }
    
    // Generate 512x512
    $result = resizeWithTransparency($adminSource, __DIR__ . '/assets/admin-icon-512.png', 512, 512);
    if ($result === true) {
        echo "<p>✅ Created admin-icon-512.png</p>";
    } else {
        echo "<p>❌ Error: $result</p>";
    }
} else {
    echo "<p>❌ Source not found: assets/admin-favicon.png</p>";
}

// Process Kid Icons
echo "<h2>Kid Icons</h2>";
$kidSource = __DIR__ . '/assets/kid-favicon.png';

if (file_exists($kidSource)) {
    $info = getimagesize($kidSource);
    echo "<p>Source: kid-favicon.png ({$info[0]}x{$info[1]})</p>";
    
    // Generate 192x192
    $result = resizeWithTransparency($kidSource, __DIR__ . '/assets/kid-icon-192.png', 192, 192);
    if ($result === true) {
        echo "<p>✅ Created kid-icon-192.png</p>";
    } else {
        echo "<p>❌ Error: $result</p>";
    }
    
    // Generate 512x512
    $result = resizeWithTransparency($kidSource, __DIR__ . '/assets/kid-icon-512.png', 512, 512);
    if ($result === true) {
        echo "<p>✅ Created kid-icon-512.png</p>";
    } else {
        echo "<p>❌ Error: $result</p>";
    }
} else {
    echo "<p>❌ Source not found: assets/kid-favicon.png</p>";
}

echo "<hr>";
echo "<h3>Generated Files:</h3>";
echo "<ul>";
echo "<li>admin-icon-192.png (192x192)</li>";
echo "<li>admin-icon-512.png (512x512)</li>";
echo "<li>kid-icon-192.png (192x192)</li>";
echo "<li>kid-icon-512.png (512x512)</li>";
echo "</ul>";

echo "<p><strong>✅ Done! Delete this file now.</strong></p>";
echo "<p>The icons will maintain full transparency from your source PNGs.</p>";

// Show preview
echo "<h3>Preview:</h3>";
echo "<div style='background: #f0f0f0; padding: 20px;'>";
if (file_exists(__DIR__ . '/assets/admin-icon-192.png')) {
    echo "<img src='/assets/admin-icon-192.png' style='border: 1px solid #ccc; margin: 5px;'><br>";
    echo "<small>admin-icon-192.png</small><br><br>";
}
if (file_exists(__DIR__ . '/assets/kid-icon-192.png')) {
    echo "<img src='/assets/kid-icon-192.png' style='border: 1px solid #ccc; margin: 5px;'><br>";
    echo "<small>kid-icon-192.png</small>";
}
echo "</div>";
?>