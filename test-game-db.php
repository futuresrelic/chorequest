<?php
require_once __DIR__ . '/config/config.php';

echo "<h1>Game Database Test</h1>";

$db = getDb();

// Check if table exists
try {
    $result = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='game_scores'");
    $table = $result->fetch();
    
    if ($table) {
        echo "<p>✅ game_scores table exists</p>";
        
        // Check structure
        $result = $db->query("PRAGMA table_info(game_scores)");
        $columns = $result->fetchAll();
        
        echo "<h3>Table Structure:</h3><pre>";
        print_r($columns);
        echo "</pre>";
        
        // Check data
        $result = $db->query("SELECT COUNT(*) as count FROM game_scores");
        $count = $result->fetch();
        echo "<p>📊 Total scores in database: <strong>{$count['count']}</strong></p>";
        
        if ($count['count'] > 0) {
            $result = $db->query("SELECT gs.*, ku.kid_name FROM game_scores gs JOIN kid_users ku ON gs.kid_user_id = ku.id ORDER BY gs.played_at DESC LIMIT 10");
            $scores = $result->fetchAll();
            
            echo "<h3>Recent Scores:</h3>";
            echo "<table border='1' cellpadding='5'>";
            echo "<tr><th>Kid</th><th>Score</th><th>Difficulty</th><th>Played At</th></tr>";
            foreach ($scores as $score) {
                echo "<tr>";
                echo "<td>{$score['kid_name']}</td>";
                echo "<td>{$score['score']}</td>";
                echo "<td>{$score['difficulty']}</td>";
                echo "<td>{$score['played_at']}</td>";
                echo "</tr>";
            }
            echo "</table>";
        }
        
    } else {
        echo "<p>❌ game_scores table does NOT exist!</p>";
        echo "<p><a href='setup-game-leaderboard.php'>Run setup script</a></p>";
    }
    
} catch (Exception $e) {
    echo "<p>❌ Error: " . $e->getMessage() . "</p>";
}
?>