<?php
$content = file_get_contents(__DIR__ . '/api/api.php');

// Find all cases
preg_match_all("/case '([^']+)':/", $content, $matches, PREG_OFFSET_CAPTURE);

echo "<h1>API Cases Analysis</h1>";
echo "<p>Total cases: " . count($matches[0]) . "</p>";

$issues = [];

foreach ($matches[0] as $index => $match) {
    $caseName = $matches[1][$index][0];
    $caseStart = $match[1];
    
    // Find the next case or default or closing brace
    $nextCasePos = PHP_INT_MAX;
    if (isset($matches[0][$index + 1])) {
        $nextCasePos = $matches[0][$index + 1][1];
    } else {
        // Last case - find default or closing switch
        $defaultPos = strpos($content, 'default:', $caseStart);
        if ($defaultPos !== false) {
            $nextCasePos = $defaultPos;
        }
    }
    
    // Extract case content
    $caseContent = substr($content, $caseStart, $nextCasePos - $caseStart);
    
    // Check for break
    $hasBreak = (strpos($caseContent, 'break;') !== false);
    
    if (!$hasBreak) {
        $issues[] = $caseName;
        echo "<p style='color: red;'>❌ <strong>{$caseName}</strong> - MISSING BREAK!</p>";
    } else {
        echo "<p style='color: green;'>✅ {$caseName}</p>";
    }
}

echo "<hr>";
echo "<h2>Cases Missing break; Statement:</h2>";
echo "<ul>";
foreach ($issues as $case) {
    echo "<li><strong>{$case}</strong></li>";
}
echo "</ul>";

echo "<p><strong>Total missing breaks: " . count($issues) . "</strong></p>";
?>