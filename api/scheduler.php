<?php
require_once __DIR__ . '/../config/config.php';

function generateScheduleForChore($choreId) {
    $db = getDb();
    
    // Get chore details
    $stmt = $db->prepare("SELECT * FROM chores WHERE id = ?");
    $stmt->execute([$choreId]);
    $chore = $stmt->fetch();
    
    if (!$chore) return;
    
    // Clear existing schedule
    $db->prepare("DELETE FROM chore_schedule WHERE chore_id = ?")->execute([$choreId]);
    
    $startDate = new DateTime($chore['start_date']);
    $endDate = $chore['end_date'] ? new DateTime($chore['end_date']) : new DateTime('+1 year');
    
    switch ($chore['recurrence_type']) {
        case 'daily':
            generateDailySchedule($db, $choreId, $startDate, $endDate, $chore['recurrence_value']);
            break;
        case 'weekly':
            generateWeeklySchedule($db, $choreId, $startDate, $endDate, $chore['recurrence_value']);
            break;
        case 'monthly':
            generateMonthlySchedule($db, $choreId, $startDate, $endDate);
            break;
        case 'once':
            $stmt = $db->prepare("INSERT INTO chore_schedule (chore_id, due_at) VALUES (?, ?)");
            $stmt->execute([$choreId, $startDate->format('Y-m-d H:i:s')]);
            break;
    }
}

function generateDailySchedule($db, $choreId, $startDate, $endDate, $daysOfWeek = null) {
    $current = clone $startDate;
    $stmt = $db->prepare("INSERT INTO chore_schedule (chore_id, due_at) VALUES (?, ?)");
    
    // If specific days specified (e.g., "1,2,3,4,5" for weekdays)
    $allowedDays = $daysOfWeek ? explode(',', $daysOfWeek) : null;
    
    while ($current <= $endDate) {
        $dayOfWeek = $current->format('N'); // 1=Monday, 7=Sunday
        
        if (!$allowedDays || in_array($dayOfWeek, $allowedDays)) {
            $stmt->execute([$choreId, $current->format('Y-m-d 18:00:00')]);
        }
        
        $current->modify('+1 day');
    }
}

function generateWeeklySchedule($db, $choreId, $startDate, $endDate, $daysOfWeek) {
    $current = clone $startDate;
    $stmt = $db->prepare("INSERT INTO chore_schedule (chore_id, due_at) VALUES (?, ?)");
    
    // Days: 0=Sunday, 1=Monday, ..., 6=Saturday
    $allowedDays = $daysOfWeek ? explode(',', $daysOfWeek) : ['0'];
    
    while ($current <= $endDate) {
        $dayOfWeek = $current->format('w'); // 0=Sunday, 6=Saturday
        
        if (in_array($dayOfWeek, $allowedDays)) {
            $stmt->execute([$choreId, $current->format('Y-m-d 18:00:00')]);
        }
        
        $current->modify('+1 day');
    }
}

function generateMonthlySchedule($db, $choreId, $startDate, $endDate) {
    $current = clone $startDate;
    $stmt = $db->prepare("INSERT INTO chore_schedule (chore_id, due_at) VALUES (?, ?)");
    
    while ($current <= $endDate) {
        $stmt->execute([$choreId, $current->format('Y-m-d 18:00:00')]);
        $current->modify('+1 month');
    }
}
?>