<?php
// Simple icon generator
$sizes = [192, 512];

foreach ($sizes as $size) {
    $im = imagecreatetruecolor($size, $size);
    
    // Background color (blue)
    $bg = imagecolorallocate($im, 79, 70, 229);
    imagefill($im, 0, 0, $bg);
    
    // White checkmark
    $white = imagecolorallocate($im, 255, 255, 255);
    imagesetthickness($im, $size / 15);
    
    $cx = $size / 2;
    $cy = $size / 2;
    $r = $size / 3;
    
    // Draw circle
    imageellipse($im, $cx, $cy, $r * 2, $r * 2, $white);
    
    // Draw checkmark
    $x1 = $cx - $r/2;
    $y1 = $cy;
    $x2 = $cx - $r/5;
    $y2 = $cy + $r/2;
    $x3 = $cx + $r/2;
    $y3 = $cy - $r/2;
    
    imageline($im, $x1, $y1, $x2, $y2, $white);
    imageline($im, $x2, $y2, $x3, $y3, $white);
    
    imagepng($im, __DIR__ . "/assets/icon-{$size}.png");
    imagedestroy($im);
    
    echo "Created icon-{$size}.png<br>";
}

echo "Done! Delete this file now.";
?>