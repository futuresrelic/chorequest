# Security Notes

## Authentication & Sessions

### Admin Authentication
- Passwords are hashed using PHP's `password_hash()` with bcrypt
- Sessions use `httponly` and `SameSite=Lax` cookies
- Session IDs use strict mode to prevent fixation attacks

### Kid Device Authentication
- Devices are paired using 6-digit codes (one-time use)
- Each device gets a unique 64-character token
- Tokens are stored securely and verified on each request

## Password Security

### Default Password
The default admin password is `changeme`. **You must change this immediately after installation.**

To change:
1. Login to admin panel
2. Go to Settings tab
3. Enter current password and new password
4. New password must be at least 8 characters

### Password Requirements
- Minimum 8 characters
- Hashed with bcrypt (cost factor 10)
- Stored hashes are never exposed via API

## SQL Injection Prevention

All database queries use **prepared statements** with bound parameters:
```php
$stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$userId]);
```

This prevents SQL injection attacks.

## Cross-Site Scripting (XSS)

### Input Sanitization
All user inputs are sanitized:
- Trimmed of whitespace
- Limited to maximum lengths
- HTML special characters escaped when displayed

### Output Encoding
Data displayed in HTML is properly escaped to prevent XSS.

## Rate Limiting

Rate limits prevent brute force attacks:

| Action | Limit |
|--------|-------|
| Admin login | 5 attempts per 5 minutes |
| Device pairing | 5 attempts per 1 minute |

Rate limits are tracked by IP address and stored in the database.

## File Upload Security

**This application does NOT accept file uploads**, eliminating a major security risk.

## CSRF Protection

### Admin Panel
Forms use same-site cookies and session validation.

### API
All API calls require:
- Valid session (admin) or device token (kid)
- POST requests only
- JSON body (not form data)

## Data Validation

All inputs are validated:
- **Integers**: Cast to int, checked for valid range
- **Strings**: Trimmed, length-limited, sanitized
- **Enums**: Validated against allowed values
- **Required fields**: Checked before processing

## Cookie Security

Cookies are set with secure flags:
```php
ini_set('session.cookie_httponly', 1);  // No JavaScript access
ini_set('session.cookie_samesite', 'Lax');  // CSRF protection
```

## Database Security

### SQLite File Permissions
The database file should have restricted permissions:
```bash
chmod 644 data/app.sqlite
```

### Backups
- Backup database regularly
- Store backups securely (not in web root)
- Test restoration process

## Production Recommendations

### 1. Use HTTPS
Always use SSL/TLS in production:
- Get a free certificate from Let's Encrypt
- Redirect all HTTP to HTTPS
- Enable HSTS headers

### 2. Hide Error Messages
In production, disable detailed error messages:

Edit `/config/config.php`:
```php
error_reporting(0);
ini_set('display_errors', 0);
```

### 3. Remove Documentation
After setup, delete or restrict access to `/_docs/` folder:
```bash
rm -rf /_docs/
```

Or protect with `.htaccess`:
```apache
Order deny,allow
Deny from all
```

### 4. Strong Admin Password
Use a strong, unique password:
- At least 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Don't reuse passwords from other sites

### 5. Regular Updates
- Keep PHP updated to latest stable version
- Monitor for security advisories
- Test updates on staging before production

### 6. Restrict File Permissions
```bash
# Application files (read-only)
find . -type f -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;

# Data directory (writable)
chmod 775 data/
```

### 7. Web Server Configuration

#### Apache (.htaccess)
Protect sensitive files:
```apache
<Files "config.php">
    Order allow,deny
    Deny from all
</Files>

<Files "*.sqlite">
    Order allow,deny
    Deny from all
</Files>
```

#### Nginx
Add to server block:
```nginx
location ~ \.(sqlite|db)$ {
    deny all;
}

location /config/ {
    deny all;
}
```

## Audit Logging

All important actions are logged to the `audit_log` table:
- Admin login/logout
- Password changes
- Kid creation/deletion
- Chore assignments
- Submission reviews
- Reward redemptions

View logs via database:
```sql
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50;
```

## Known Limitations

1. **No account lockout**: After rate limit expires, attempts reset
2. **No 2FA**: Two-factor authentication not implemented
3. **No email verification**: Relies on physical device pairing
4. **Single admin**: Only one admin account supported
5. **No encryption at rest**: Database is not encrypted on disk

## Reporting Security Issues

If you discover a security vulnerability:
1. Do not disclose publicly
2. Document the issue with steps to reproduce
3. Include potential impact and suggested fixes
4. Contact the system administrator

## Security Checklist

- [ ] Changed default admin password
- [ ] Using HTTPS in production
- [ ] Error reporting disabled in production
- [ ] Documentation folder removed or protected
- [ ] Database file permissions set correctly
- [ ] Regular backups configured
- [ ] File permissions locked down
- [ ] Web server configuration hardened
- [ ] Strong password policy enforced
- [ ] Regular security updates scheduled

## Additional Resources

- PHP Security Cheatsheet: https://cheatsheetseries.owasp.org/cheatsheets/PHP_Configuration_Cheat_Sheet.html
- SQLite Security: https://www.sqlite.org/security.html
- OWASP Top 10: https://owasp.org/www-project-top-ten/