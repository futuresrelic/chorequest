# Family Chores & Quests - Setup Guide

## Requirements

- Web server with PHP 8.0 or higher
- SQLite support enabled (usually included with PHP)
- Apache or Nginx
- No database server needed (uses SQLite file-based database)

## Installation Steps

### 1. Upload Files

Upload the entire `family-chores-app` folder to your web server. The structure should look like:
```
/family-chores-app/
  /admin/
  /kid/
  /api/
  /config/
  /assets/
  /_docs/
  /data/ (will be created automatically)
```

### 2. Set Permissions

Make sure the `/data/` directory is writable by the web server:
```bash
chmod 775 family-chores-app/data/
```

If the directory doesn't exist, it will be created automatically with the correct permissions.

### 3. Access Admin Panel

Navigate to: `https://your-domain.com/family-chores-app/admin/`

**Default login credentials:**
- Email: `admin@example.com`
- Password: `changeme`

### 4. IMPORTANT: Change Password Immediately

After logging in:
1. Go to the **Settings** tab
2. Change your password to something secure
3. Use at least 8 characters with a mix of letters, numbers, and symbols

### 5. Add Kids

1. Go to the **Kids** tab
2. Click **Add Kid**
3. Enter the child's name
4. Click **Add Kid**

### 6. Generate Pairing Code

For each kid:
1. Click **Get Code** next to their name
2. A 6-digit code will be displayed
3. Have the child enter this code on their device

### 7. Kid Device Pairing

On the child's device:
1. Navigate to: `https://your-domain.com/family-chores-app/kid/`
2. Enter the pairing code
3. The device is now paired and ready to use

### 8. Create Chores

1. Go to the **Chores** tab
2. Click **Add Chore**
3. Fill in the details:
   - **Title**: Name of the chore
   - **Description**: Optional details
   - **Frequency**: Daily, Weekly, or One-time
   - **Points**: How many points the chore is worth
   - **Requires Approval**: Check if you want to approve completions manually
4. Click **Add Chore**

### 9. Assign Chores to Kids

1. In the **Chores** tab, click **Assign** on a chore
2. Select a kid from the dropdown
3. Click **Assign**

### 10. Create Quests (Optional)

1. Go to the **Quests** tab
2. Click **Add Quest**
3. Enter quest details and target reward
4. After creating, click **Tasks** to add quest tasks
5. Add multiple tasks with points for each

### 11. Create Rewards (Optional)

1. Go to the **Rewards** tab
2. Click **Add Reward**
3. Enter reward details and point cost
4. Kids can redeem rewards when they have enough points

## Database Location

The SQLite database is stored at:
```
/family-chores-app/data/app.sqlite
```

**Backup your database regularly** by downloading this file.

## Troubleshooting

### Database Won't Create

**Issue**: "Database error" on first load

**Solution**:
```bash
# Create the data directory manually
mkdir family-chores-app/data
chmod 775 family-chores-app/data
```

### Can't Login

**Issue**: Login fails with correct credentials

**Solution**:
- Clear your browser cache and cookies
- Make sure cookies are enabled
- Try a different browser

### Pairing Code Doesn't Work

**Issue**: "Invalid pairing code" error

**Solution**:
- Make sure the code is entered in UPPERCASE
- Generate a new code and try again
- Check that the kid exists in the admin panel

### Kid App Not Updating

**Issue**: Changes in admin panel don't show on kid's device

**Solution**:
- Click the refresh button in the kid app
- The app polls for updates every 25 seconds automatically
- Clear browser cache if needed

### File Permissions Issues

If you see permission errors, you may need to adjust file permissions:
```bash
# Make data directory writable
chmod 775 family-chores-app/data/

# If that doesn't work, try:
chmod 777 family-chores-app/data/
```

## Security Recommendations

1. **Change the default admin password immediately**
2. Use HTTPS (SSL certificate) for your domain
3. Keep the `/_docs/` folder private or delete it after setup
4. Regularly backup your database file
5. Don't share pairing codes publicly
6. Revoke devices that are no longer in use

## Updating the App

To update to a new version:
1. **Backup your database file** (`/data/app.sqlite`)
2. Upload new files, overwriting old ones
3. Keep your database file intact
4. Test the admin panel first before kids use it

## Support

For issues or questions:
- Check the API_REFERENCE.md for technical details
- Check the SECURITY_NOTES.md for security best practices
- Review browser console for JavaScript errors

## Advanced: Custom Timezone

To change the timezone, edit `/config/config.php`:
```php
date_default_timezone_set('America/Los_Angeles'); // Change this line
```

Available timezones: https://www.php.net/manual/en/timezones.php

## Uninstallation

To completely remove the app:
1. Backup your database if you want to keep records
2. Delete the entire `family-chores-app` folder
3. That's it! No database server to clean up.