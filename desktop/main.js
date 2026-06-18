const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, '.env.desktop') });

const BACKEND_URL = process.env.VONDIC_BACKEND_URL || 'http://localhost:5000';
const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID || '';
const YANDEX_REDIRECT_URI = process.env.YANDEX_REDIRECT_URI || '';

let mainWindow;
let authWindow;
let desktopSessionId = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Get Yandex auth URL
ipcMain.handle('get-yandex-auth-url', async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/yandex/login`);
    const data = await response.json();
    return { success: true, authUrl: data.auth_url };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Authenticate with API key + cloud password
ipcMain.handle('auth-api-key', async (event, { apiKey, cloudPassword }) => {
  try {
    const payload = { api_key: apiKey };
    if (cloudPassword) {
      payload.cloud_password = cloudPassword;
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/auth/api-key-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Authentication failed' };
    }

    // Check if cloud_password is set
    if (!data.cloud_password_set && !cloudPassword) {
      return { 
        success: false, 
        needsCloudPassword: true, 
        message: 'Cloud password is required. Please set it.' 
      };
    }

    return { 
      success: true, 
      accessToken: data.access_token, 
      refreshToken: data.refresh_token, 
      user: data.user 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Start Yandex OAuth flow for desktop
ipcMain.handle('start-yandex-oauth', async () => {
  return new Promise((resolve) => {
    desktopSessionId = require('crypto').randomBytes(16).toString('hex');
    
    const authUrl = `${BACKEND_URL}/api/v1/auth/yandex/login?cid=${desktopSessionId}`;
    
    authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      show: false,
      webPreferences: {
        nodeIntegration: false,
      },
    });

    authWindow.loadURL(authUrl);
    authWindow.show();

    // Poll for session completion
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/v1/auth/yandex/desktop-session?cid=${desktopSessionId}`
        );
        const data = await response.json();

        if (data.ready) {
          clearInterval(pollInterval);
          authWindow.close();
          resolve({
            success: true,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            user: data.user,
          });
        }
      } catch (error) {
        // Continue polling
      }
    }, 2000);

    authWindow.on('closed', () => {
      clearInterval(pollInterval);
      authWindow = null;
      resolve({ success: false, error: 'Authentication cancelled' });
    });
  });
});

// Verify token and get user info
ipcMain.handle('get-user-info', async (event, accessToken) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error };
    }

    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
