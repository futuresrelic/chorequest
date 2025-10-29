<?php
require_once __DIR__ . '/config/config.php';

echo "<style>body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }</style>";
echo "<h1>🎮 Reset Game Scores</h1>";

try {
    $db = getDb();
    
    // List all kids
    $stmt = $db->query("SELECT id, kid_name, total_points FROM users WHERE role = 'kid' ORDER BY kid_name");
    $kids = $stmt->fetchAll();
    
    if (empty($kids)) {
        echo "<p>No kids found!</p>";
        exit;
    }
    
    // If kid selected, show confirmation
    if (isset($_GET['kid_id'])) {
        $kidId = intval($_GET['kid_id']);
        $kid = array_filter($kids, fn($k) => $k['id'] === $kidId)[0] ?? null;
        
        if (!$kid) {
            echo "<p style='color: red;'>Kid not found!</p>";
            exit;
        }
        
        // Count scores
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM game_scores WHERE kid_user_id = ?");
        $stmt->execute([$kidId]);
        $scoreCount = $stmt->fetch()['count'];
        
        if (isset($_GET['confirm']) && $_GET['confirm'] === 'yes') {
            // DELETE SCORES
            $stmt = $db->prepare("DELETE FROM game_scores WHERE kid_user_id = ?");
            $stmt->execute([$kidId]);
            
            echo "<div style='background: #d1fae5; padding: 20px; border-radius: 8px; color: #065f46;'>";
            echo "<h2>✅ Scores Reset!</h2>";
            echo "<p>All <strong>$scoreCount game scores</strong> for <strong>{$kid['kid_name']}</strong> have been deleted.</p>";
            echo "<p><a href='reset-game-scores.php'>← Back to kids list</a></p>";
            echo "</div>";
        } else {
            // Show confirmation
            echo "<div style='background: #fef3c7; padding: 20px; border-radius: 8px; color: #92400e;'>";
            echo "<h2>⚠️ Confirm Reset</h2>";
            echo "<p>You're about to delete <strong>$scoreCount game scores</strong> for:</p>";
            echo "<p style='font-size: 20px; font-weight: bold;'>{$kid['kid_name']}</p>";
            echo "<p><strong>This cannot be undone!</strong></p>";
            echo "<div style='margin-top: 20px;'>";
            echo "<a href='?kid_id=$kidId&confirm=yes' style='display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 8px; margin-right: 10px;'>Yes, Delete All Scores</a>";
            echo "<a href='reset-game-scores.php' style='display: inline-block; padding: 12px 24px; background: #6b7280; color: white; text-decoration: none; border-radius: 8px;'>Cancel</a>";
            echo "</div></div>";
        }
        
    } else {
        // Show kids list
        echo "<p>Select a kid to reset their game scores:</p>";
        echo "<div style='display: flex; flex-direction: column; gap: 10px;'>";
        
        foreach ($kids as $kid) {
            // Count their scores
            $stmt = $db->prepare("SELECT COUNT(*) as count FROM game_scores WHERE kid_user_id = ?");
            $stmt->execute([$kid['id']]);
            $scoreCount = $stmt->fetch()['count'];
            
            echo "<a href='?kid_id={$kid['id']}' style='padding: 15px; border: 2px solid #e5e7eb; border-radius: 8px; text-decoration: none; color: #111; display: block;'>";
            echo "<div style='font-weight: 600; font-size: 18px;'>{$kid['kid_name']}</div>";
            echo "<div style='color: #6b7280; font-size: 14px;'>$scoreCount game scores | {$kid['total_points']} total points</div>";
            echo "</a>";
        }
        
        echo "</div>";
    }
    
} catch (Exception $e) {
    echo "<p style='color: red;'>Error: " . $e->getMessage() . "</p>";
}
?>