# API Reference

All API calls are made to `/api/api.php` via POST with JSON body.

## Request Format
```json
{
  "action": "action_name",
  "param1": "value1",
  "param2": "value2"
}
```

## Response Format

Success:
```json
{
  "ok": true,
  "data": { ... }
}
```

Error:
```json
{
  "ok": false,
  "error": "Error message"
}
```

## Authentication

### Admin Endpoints
Require active PHP session with `admin_id` set.

### Kid Endpoints
Require valid `kid_token` cookie from device pairing.

---

## Admin Authentication

### `admin_login`
Login as admin

**Request:**
```json
{
  "action": "admin_login",
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "email": "admin@example.com"
  }
}
```

### `admin_logout`
Logout admin

**Request:**
```json
{
  "action": "admin_logout"
}
```

### `admin_me`
Get current admin info

**Request:**
```json
{
  "action": "admin_me"
}
```

### `admin_change_password`
Change admin password

**Request:**
```json
{
  "action": "admin_change_password",
  "current_password": "oldpass",
  "new_password": "newpass123"
}
```

---

## Kids Management

### `create_kid`
Create a new kid (Admin only)

**Request:**
```json
{
  "action": "create_kid",
  "name": "Alex"
}
```

### `list_kids`
List all kids (Admin only)

**Request:**
```json
{
  "action": "list_kids"
}
```

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 2,
      "kid_name": "Alex",
      "total_points": 150,
      "device_count": 1,
      "chore_count": 3
    }
  ]
}
```

### `delete_kid`
Delete a kid (Admin only)

**Request:**
```json
{
  "action": "delete_kid",
  "kid_id": 2
}
```

### `generate_pairing_code`
Generate device pairing code (Admin only)

**Request:**
```json
{
  "action": "generate_pairing_code",
  "kid_id": 2
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "code": "ABC123",
    "kid_id": 2
  }
}
```

---

## Device Pairing

### `pair_device`
Pair a device with pairing code (Public)

**Request:**
```json
{
  "action": "pair_device",
  "code": "ABC123",
  "device_label": "iPhone"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "kid_id": 2,
    "kid_name": "Alex",
    "token": "generated_token_here"
  }
}
```

Sets cookie: `kid_token`

### `kid_me`
Get current kid info (Kid only)

**Request:**
```json
{
  "action": "kid_me"
}
```

---

## Chores

### `create_chore`
Create a chore (Admin only)

**Request:**
```json
{
  "action": "create_chore",
  "title": "Make Bed",
  "description": "Make your bed neatly",
  "is_recurring": 1,
  "frequency": "daily",
  "default_points": 5,
  "requires_approval": 0
}
```

### `list_chores`
List all chores (Admin only)

**Request:**
```json
{
  "action": "list_chores"
}
```

### `assign_chore_to_kid`
Assign chore to kid (Admin only)

**Request:**
```json
{
  "action": "assign_chore_to_kid",
  "kid_id": 2,
  "chore_id": 1
}
```

### `list_kid_chores`
List kid's assigned chores

**Request:**
```json
{
  "action": "list_kid_chores",
  "kid_id": 2
}
```

---

## Submissions

### `submit_chore_completion`
Submit chore completion (Kid only)

**Request:**
```json
{
  "action": "submit_chore_completion",
  "chore_id": 1,
  "note": "All done!"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "submission_id": 15,
    "status": "pending",
    "points_awarded": 0
  }
}
```

If auto-approved:
```json
{
  "ok": true,
  "data": {
    "submission_id": 15,
    "status": "approved",
    "points_awarded": 5
  }
}
```

### `list_submissions`
List submissions (Admin only)

**Request:**
```json
{
  "action": "list_submissions",
  "status": "pending"
}
```

Status options: `pending`, `approved`, `rejected`

### `review_submission`
Review a submission (Admin only)

**Request:**
```json
{
  "action": "review_submission",
  "submission_id": 15,
  "status": "approved",
  "points_override": 10,
  "note": "Great job!"
}
```

---

## Quests

### `create_quest`
Create a quest (Admin only)

**Request:**
```json
{
  "action": "create_quest",
  "title": "Waterpark Trip",
  "description": "Complete all tasks to earn waterpark trip",
  "target_reward": "Family waterpark visit"
}
```

### `create_quest_task`
Add task to quest (Admin only)

**Request:**
```json
{
  "action": "create_quest_task",
  "quest_id": 1,
  "title": "Read 3 Books",
  "description": "Read and report on 3 books",
  "points": 50,
  "order_index": 1
}
```

### `kid_submit_task`
Submit quest task (Kid only)

**Request:**
```json
{
  "action": "kid_submit_task",
  "task_id": 3,
  "note": "I read Harry Potter, Percy Jackson, and Diary of a Wimpy Kid"
}
```

### `review_quest_task`
Review quest task submission (Admin only)

**Request:**
```json
{
  "action": "review_quest_task",
  "status_id": 5,
  "status": "approved"
}
```

### `kid_quest_progress`
Get kid's quest progress (Kid only)

**Request:**
```json
{
  "action": "kid_quest_progress"
}
```

---

## Rewards

### `create_reward`
Create a reward (Admin only)

**Request:**
```json
{
  "action": "create_reward",
  "title": "1 Hour Phone Time",
  "description": "Get 1 extra hour of phone time",
  "cost_points": 50
}
```

### `list_rewards`
List all rewards

**Request:**
```json
{
  "action": "list_rewards"
}
```

### `kid_redeem_reward`
Redeem a reward (Kid only)

**Request:**
```json
{
  "action": "kid_redeem_reward",
  "reward_id": 1
}
```

### `review_redemption`
Review redemption request (Admin only)

**Request:**
```json
{
  "action": "review_redemption",
  "redemption_id": 3,
  "status": "approved"
}
```

---

## Feed & Stats

### `kid_feed`
Get kid's complete feed (Kid only)

**Request:**
```json
{
  "action": "kid_feed"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "kid_name": "Alex",
    "total_points": 150,
    "chores": [...],
    "submissions": [...],
    "quests": [...]
  }
}
```

### `stats_overview`
Get admin dashboard stats (Admin only)

**Request:**
```json
{
  "action": "stats_overview"
}
```

---

## Rate Limiting

The following actions are rate-limited:
- `admin_login`: 5 attempts per 5 minutes
- `pair_device`: 5 attempts per 1 minute

## Error Codes

Common error messages:
- `"Unauthorized"` - Not logged in or invalid token
- `"Rate limit exceeded"` - Too many requests
- `"Invalid action"` - Unknown action parameter
- `"Database error"` - Internal database issue