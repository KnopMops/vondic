# OAuth 2.0 Documentation - Vondic

Vondic supports OAuth 2.0 authorization (Yandex-style), allowing third-party applications to access the API on behalf of users.

## Table of Contents

1. [Overview](#overview)
2. [Supported Flows](#supported-flows)
3. [Registering an Application](#registering-an-application)
4. [OAuth 2.0 Flow](#oauth-20-flow)
5. [API Endpoints](#api-endpoints)
6. [Scopes](#scopes)
7. [Security Considerations](#security-considerations)
8. [Error Codes](#error-codes)
9. [Examples](#examples)

---

## Overview

OAuth 2.0 is the industry-standard protocol for authorization. Vondic implements OAuth 2.0 to allow third-party applications to:

- Access user data with their permission
- Perform actions on behalf of users
- Integrate with the Vondic platform securely

### Base URLs

- **Authorization Server**: `https://vondic.ru/oauth`
- **API Base URL**: `https://vondic.ru/api`
- **Public API**: `https://api.vondic.ru/api/public/v1`

---

## Supported Flows

### 1. Authorization Code Grant (Recommended)
For web and mobile applications. This is the most secure flow as it doesn't expose tokens to the user-agent.

### 2. Refresh Token Grant
For obtaining new access tokens without user re-authentication.

---

## Registering an Application

Before you can use OAuth, you need to register your application:

### Step-by-Step Guide

1. **Log in** to your Vondic account
2. Go to **Profile Settings** → **Developer Settings**
3. Click **"Create Application"**
4. Fill in the application details:
   - **Name** - Your application name (visible to users)
   - **Description** - Brief description of your app
   - **Redirect URIs** - Allowed callback URLs (comma-separated)
5. Click **"Create"**

### Important Notes

- **Client ID** - Public identifier for your app
- **Client Secret** - Confidential key (shown only once!) - store it securely
- **Redirect URIs** - Must match exactly during authorization

### Example Redirect URIs

```
https://yourapp.com/callback
http://localhost:3000/callback  # For development
```

---

## OAuth 2.0 Flow

### Step 1: Authorization Request

Redirect the user to the authorization page:

```http
GET /oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}&state={state}
```

#### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `client_id` | Yes | Your application's client ID |
| `redirect_uri` | Yes | Callback URL (must be in allowed list) |
| `response_type` | Yes | Must be `code` |
| `scope` | No | Requested permissions (space-separated) |
| `state` | Recommended | CSRF protection string (returned in callback) |

#### Example Request

```bash
https://vondic.ru/oauth/authorize?
  client_id=abc123&
  redirect_uri=https://yourapp.com/callback&
  response_type=code&
  state=xyz123&
  scope=
```

### Step 2: User Authorization

The user will see an authorization page displaying:
- Application name and description
- Requested permissions (scopes)
- Allow/Deny buttons

When the user clicks **"Allow"**, Vondic will redirect to your callback URL.

### Step 3: Authorization Code Callback

After user approval, the browser redirects to:

```http
GET https://yourapp.com/callback?code={authorization_code}&state={state}
```

#### Response Parameters

| Parameter | Description |
|-----------|-------------|
| `code` | Authorization code (valid for 10 minutes) |
| `state` | The state value you provided (verify it matches!) |

⚠️ **Security Note**: Always verify the `state` parameter to prevent CSRF attacks!

### Step 4: Token Exchange

Exchange the authorization code for an access token:

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
```

#### Request Body

```
grant_type=authorization_code&
code={authorization_code}&
redirect_uri={redirect_uri}&
client_id={client_id}&
client_secret={client_secret}
```

#### Example Request (cURL)

```bash
curl -X POST https://vondic.ru/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=abc123def456" \
  -d "redirect_uri=https://yourapp.com/callback" \
  -d "client_id=your_client_id" \
  -d "client_secret=your_client_secret"
```

#### Response

```json
{
  "access_token": "token123abc",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": ""
}
```

### Step 5: Using the Access Token

Include the access token in API requests:

```http
GET /oauth/userinfo
Authorization: Bearer {access_token}
```

#### Example Request

```bash
curl https://vondic.ru/oauth/userinfo \
  -H "Authorization: Bearer token123abc"
```

#### Response

```json
{
  "id": "user_id_here",
  "username": "user123",
  "email": "user@example.com",
  "role": "User",
  "status": "online",
  "balance": 0,
  "premium": 0,
  "disk_usage": 0,
  "disk_limit": 1073741824
}
```

---

## Refresh Token

When the access token expires, use the refresh token flow to get a new one:

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
```

### Request Body

```
grant_type=refresh_token&
refresh_token={access_token}&
client_id={client_id}&
client_secret={client_secret}
```

### Example

```bash
curl -X POST https://vondic.ru/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=old_access_token_here" \
  -d "client_id=your_client_id" \
  -d "client_secret=your_client_secret"
```

---

## API Endpoints

### Authorization Endpoints

#### GET/POST /oauth/authorize

Authorization page. Returns HTML form for user consent.

**Authentication**: Required (user's access_token via `Authorization: Bearer` header)

**Methods**:
- `GET` - Display authorization page
- `POST` - Process user decision (allow/deny)

#### POST /oauth/token

Obtain access token.

**Supported grant_types**:
- `authorization_code` - Exchange code for token
- `refresh_token` - Refresh expired token

**No authentication required** (uses client_id and client_secret)

### Resource Endpoints

#### GET /oauth/userinfo

Get current user information.

**Authentication**: `Authorization: Bearer {access_token}`

**Response**:
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "role": "User|Admin|Moderator",
  "status": "online|offline|away|busy",
  "balance": 0,
  "premium": 0,
  "disk_usage": 0,
  "disk_limit": 1073741824,
  "avatar_url": "string|null",
  "first_name": "string|null",
  "last_name": "string|null"
}
```

### Client Management Endpoints

#### GET /oauth/clients

List user's OAuth clients.

**Authentication**: `Authorization: Bearer {access_token}` (user's token)

#### POST /oauth/clients

Create a new OAuth client.

**Authentication**: `Authorization: Bearer {access_token}` (user's token)

**Request Body**:
```json
{
  "name": "My Application",
  "description": "Optional description",
  "redirect_uris": ["https://myapp.com/callback"]
}
```

**Response**:
```json
{
  "id": "uuid",
  "client_id": "string",
  "client_secret": "string",  // Only returned on creation!
  "name": "string",
  "description": "string",
  "redirect_uris": "string",  // Comma-separated
  "is_active": 1,
  "created_at": "timestamp"
}
```

#### DELETE /oauth/clients/{client_id}

Delete an OAuth client.

**Authentication**: `Authorization: Bearer {access_token}` (user's token)

---

## Scopes

Currently, Vondic OAuth does not implement scopes (the scope parameter is accepted but ignored). All authorized applications receive full access to the user's data.

Future versions may support:
- `read_profile` - Read user profile information
- `read_posts` - Read user's posts
- `write_posts` - Create and modify posts
- `read_messages` - Read messages
- `write_messages` - Send messages

---

## Security Considerations

### 1. Protect Your Client Secret
- **Never** expose your client_secret in client-side code (browsers, mobile apps)
- Store it securely on your server
- If compromised, regenerate it immediately via the developer settings

### 2. Use HTTPS
- Always use HTTPS for redirect_uris in production
- This prevents token interception

### 3. Validate the State Parameter
```python
# Generate a random state
import secrets
state = secrets.token_urlsafe(32)

# Store it in the user's session
session['oauth_state'] = state

# When receiving the callback, verify it
if request.args.get('state') != session.get('oauth_state'):
    raise Exception('Invalid state - possible CSRF attack!')
```

### 4. Token Expiration
- Access tokens expire in **1 hour**
- Authorization codes expire in **10 minutes**
- Implement automatic token refresh in your application

### 5. Secure Token Storage
- Store access tokens securely (server-side, encrypted database)
- Never log tokens or expose them in URLs
- Clear tokens when the user logs out

---

## Error Codes

### Authorization Endpoint Errors

| Error | Description |
|-------|-------------|
| `invalid_request` | Missing required parameters |
| `unauthorized` | User not authenticated |
| `invalid_client` | Client ID not found or inactive |
| `invalid_redirect_uri` | Redirect URI not in allowed list |
| `access_denied` | User denied the authorization |
| `unsupported_response_type` | Only `code` is supported |

### Token Endpoint Errors

| Error | Description |
|-------|-------------|
| `invalid_client` | Invalid client_id or client_secret |
| `invalid_grant` | Invalid authorization code or refresh token |
| `unsupported_grant_type` | Only `authorization_code` and `refresh_token` supported |

### Userinfo Endpoint Errors

| Error | Description |
|-------|-------------|
| `invalid_request` | Missing access token |
| `invalid_token` | Token is invalid or expired |
| `user_not_found` | User associated with token not found |

---

## Examples

### Python Example (Flask)

See `docs/oauth_example.py` for a complete Flask application implementing OAuth.

### JavaScript Example (Node.js/Express)

```javascript
const express = require('express');
const axios = require('axios');
const app = express();

const CLIENT_ID = 'your_client_id';
const CLIENT_SECRET = 'your_client_secret';
const REDIRECT_URI = 'http://localhost:3000/callback';

// Step 1: Redirect to authorization page
app.get('/login', (req, res) => {
    const state = Math.random().toString(36).substring(7);
    req.session.state = state;
    
    const authUrl = `https://vondic.ru/oauth/authorize?` +
        `client_id=${CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `response_type=code&` +
        `state=${state}`;
    
    res.redirect(authUrl);
});

// Step 2: Handle callback
app.get('/callback', async (req, res) => {
    const { code, state } = req.query;
    
    // Verify state
    if (state !== req.session.state) {
        return res.status(400).send('Invalid state');
    }
    
    try {
        // Exchange code for token
        const tokenResponse = await axios.post(
            'https://vondic.ru/oauth/token',
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        
        const { access_token } = tokenResponse.data;
        
        // Get user info
        const userResponse = await axios.get(
            'https://vondic.ru/oauth/userinfo',
            { headers: { 'Authorization': `Bearer ${access_token}` } }
        );
        
        res.json({ user: userResponse.data, access_token });
    } catch (error) {
        res.status(500).send('OAuth failed');
    }
});
```

### PHP Example

```php
<?php
session_start();

$clientId = 'your_client_id';
$clientSecret = 'your_client_secret';
$redirectUri = 'https://yourapp.com/callback';

// Step 1: Redirect to authorization
if (!isset($_GET['code'])) {
    $state = bin2hex(random_bytes(16));
    $_SESSION['oauth_state'] = $state;
    
    $authUrl = 'https://vondic.ru/oauth/authorize?' . http_build_query([
        'client_id' => $clientId,
        'redirect_uri' => $redirectUri,
        'response_type' => 'code',
        'state' => $state
    ]);
    
    header("Location: $authUrl");
    exit;
}

// Step 2: Handle callback
$state = $_GET['state'] ?? '';
if (!hash_equals($_SESSION['oauth_state'] ?? '', $state)) {
    die('Invalid state parameter');
}

$code = $_GET['code'];

// Exchange code for token
$ch = curl_init('https://vondic.ru/oauth/token');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    'grant_type' => 'authorization_code',
    'code' => $code,
    'redirect_uri' => $redirectUri,
    'client_id' => $clientId,
    'client_secret' => $clientSecret
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);

$response = json_decode(curl_exec($ch), true);
$accessToken = $response['access_token'];

// Get user info
$ch = curl_init('https://vondic.ru/oauth/userinfo');
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $accessToken"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$userInfo = json_decode(curl_exec($ch), true);
print_r($userInfo);
```

---

## Testing Your Integration

1. **Use localhost for development** - Register `http://localhost:PORT/callback` as a redirect URI
2. **Test the full flow** - Authorization → Callback → Token Exchange → API Call
3. **Handle errors gracefully** - Always check for error responses
4. **Implement token refresh** - Test with expired tokens

---

## Support

For questions or issues with OAuth integration:
- Check this documentation
- Review the example applications
- Contact the Vondic development team

---

**Last Updated**: May 2026
