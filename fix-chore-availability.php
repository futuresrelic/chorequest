<?php
/**
 * FIX CHORE AVAILABILITY
 * 
 * This updates the logic so chores are available immediately when assigned,
 * and only reset to +X days after completion.
 * 
 * Upload to: https://tasks.futuresrelic.com/fix-chore-availability.php
 * Run once, then delete.
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<style>
body { font-family: system-ui; max-width: 900px; margin: 40px auto; padding: 0 20px; }
.success { background: #efe; padding: 20px; border-radius: 8px; color: #060; }
.info { background: #e3f2fd; padding: 20px; border-radius: 8px; color: #1565c0; }
</style>";

echo "<h1>🔧 Fix Chore Availability Logic</h1>";

require_once __DIR__ . '/config/config.php';

try {
    $db = getDb();
    
    echo "<h2>Step 1: Set All Existing Chores to Due Now</h2>";
    
    // Get current chores
    $stmt = $db->query("
        SELECT kc.*, u.kid_name, c.title, c.recurrence_type
        FROM kid_chores kc
        JOIN users u ON kc.kid_user_id = u.id
        JOIN chores c ON kc.chore_id = c.id
    ");
    $chores = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($chores)) {
        echo "<p>No chores assigned yet.</p>";
    } else {
        echo "<p>Found " . count($chores) . " assigned chores:</p>";
        echo "<ul>";
        foreach ($chores as $chore) {
            echo "<li>{$chore['kid_name']} - {$chore['title']} (was due: {$chore['next_due_at']})</li>";
        }
        echo "</ul>";
        
        // Set all to due now
        $db->exec("UPDATE kid_chores SET next_due_at = datetime('now')");
        
        echo "<div class='success'>";
        echo "<p>✅ All chores are now available to complete immediately!</p>";
        echo "</div>";
    }
    
    echo "<h2>Step 2: Update calculateNextDue Function</h2>";
    
    echo "<div class='info'>";
    echo "<h3>📝 Manual Update Required</h3>";
    echo "<p>Now you need to update the logic in your code so that:</p>";
    echo "<ul>";
    echo "<li><strong>On assignment:</strong> Chores are due immediately (or now)</li>";
    echo "<li><strong>On completion:</strong> Next due date is set to +X days/weeks</li>";
    echo "</ul>";
    echo "</div>";
    
    echo "<h3>Update #1: config/config.php - calculateNextDue()</h3>";
    echo "<p>This function is currently used for <strong>assignment</strong>. Change it to return 'now':</p>";
    echo "<pre style='background: #f5f5f5; padding: 15px; border-radius: 5px;'>";
    echo htmlspecialchars('
function calculateNextDue($recurrenceType) {
    // For initial assignment, chores are due immediately
    // They will be reset after completion
    return date(\'Y-m-d H:i:s\'); // Always return NOW
}
');
    echo "</pre>";
    
    echo "<h3>Update #2: api/api.php - Add New Function</h3>";
    echo "<p>Add this NEW function for calculating the NEXT due date after completion:</p>";
    echo "<pre style='background: #f5f5f5; padding: 15px; border-radius: 5px;'>";
    echo htmlspecialchars('
function calculateNextDueAfterCompletion($recurrenceType) {
    switch ($recurrenceType) {
        case \'daily\':
            return date(\'Y-m-d H:i:s\', strtotime(\'+1 day\'));
        case \'weekly\':
            return date(\'Y-m-d H:i:s\', strtotime(\'+1 week\'));
        case \'monthly\':
            return date(\'Y-m-d H:i:s\', strtotime(\'+1 month\'));
        case \'once\':
            return null; // One-time chores don\'t repeat
        default:
            return date(\'Y-m-d H:i:s\', strtotime(\'+1 day\'));
    }
}
');
    echo "</pre>";
    
    echo "<h3>Update #3: api/api.php - submit_chore_completion case</h3>";
    echo "<p>Find the section that handles chore completion and update to use the new function:</p>";
    echo "<pre style='background: #f5f5f5; padding: 15px; border-radius: 5px;'>";
    echo htmlspecialchars('
// In submit_chore_completion case, find this section:

if ($status === \'approved\') {
    $stmt = $db->prepare("UPDATE users SET total_points = total_points + ? WHERE id = ?");
    $stmt->execute([$pointsAwarded, $kid[\'kid_user_id\']]);
    
    // UPDATE THIS SECTION ↓
    if ($kidChore[\'recurrence_type\'] !== \'once\') {
        // Use NEW function for post-completion due date
        $nextDue = calculateNextDueAfterCompletion($kidChore[\'recurrence_type\']);
        $newStreak = $kidChore[\'streak_count\'] + 1;
        
        $stmt = $db->prepare("
            UPDATE kid_chores 
            SET streak_count = ?, last_completed_at = datetime(\'now\'), next_due_at = ?
            WHERE kid_user_id = ? AND chore_id = ?
        ");
        $stmt->execute([$newStreak, $nextDue, $kid[\'kid_user_id\'], $choreId]);
    } else {
        // One-time chores: remove from kid_chores after completion
        $stmt = $db->prepare("DELETE FROM kid_chores WHERE kid_user_id = ? AND chore_id = ?");
        $stmt->execute([$kid[\'kid_user_id\'], $choreId]);
    }
}
');
    echo "</pre>";
    
    echo "<hr>";
    echo "<div class='success'>";
    echo "<h2>✅ Step 1 Complete!</h2>";
    echo "<p>All existing chores are now available immediately.</p>";
    echo "<h3>Next Steps:</h3>";
    echo "<ol>";
    echo "<li>Update <code>config/config.php</code> - Change calculateNextDue() to return 'now'</li>";
    echo "<li>Add <code>calculateNextDueAfterCompletion()</code> function to api.php</li>";
    echo "<li>Update <code>submit_chore_completion</code> case to use the new function</li>";
    echo "<li>Test: Assign new chore → should be available immediately</li>";
    echo "<li>Test: Complete chore → should reset to +7 days for weekly</li>";
    echo "<li><strong>Delete this script</strong></li>";
    echo "</ol>";
    echo "</div>";
    
    echo "<br>";
    echo "<a href='admin/' style='display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin-right: 10px;'>Go to Admin Panel</a>";
    echo "<a href='kid/' style='display: inline-block; padding: 12px 24px; background: #6b7280; color: white; text-decoration: none; border-radius: 8px;'>Go to Kid App</a>";
    
} catch (Exception $e) {
    echo "<div style='background: #fee; padding: 20px; border-radius: 8px; color: #c00;'>";
    echo "<h2>❌ Error</h2>";
    echo "<p><strong>Message:</strong> " . $e->getMessage() . "</p>";
    echo "</div>";
}
?>
