const { app, BrowserWindow, shell, ipcMain, net } = require('electron')
const path = require('path')
const url = require('url')
const fetch = require('node-fetch')
require('dotenv').config({ path: path.join(__dirname, '../.env.desktop') })
require('dotenv').config({ path: path.join(__dirname, '../.env') })

let mainWindow = null
let nextServerProcess = null

async function startNextServer() {
  const net = require('net');
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const p = server.address().port;
      server.close(() => resolve(p));
    });
    server.on('error', reject);
  });

  const { fork } = require('child_process');
  const path = require('path');
  const fs = require('fs');
  const serverPath = path.join(__dirname, '../.next/standalone/server.js');

  const logDir = app.getPath('userData');
  const logFile = path.join(logDir, 'next-server.log');
  const logStream = fs.openSync(logFile, 'w');

  console.log(`Starting Next.js standalone server on port ${port}...`);
  console.log(`Next.js server logs will be written to: ${logFile}`);

  nextServerProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: 'localhost'
    },
    stdio: ['ignore', logStream, logStream, 'ipc']
  });

  // Wait for server to bind
  await new Promise(resolve => setTimeout(resolve, 800));
  return port;
}

function createWindow(port = 3000) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: process.env.NODE_ENV === 'development' ? false : true,
    },
    title: 'Vondic Messenger',
    icon: path.join(__dirname, '../public/favicon.ico'),
  })

  // Load appropriate URL based on environment
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadURL(`http://localhost:${port}`)
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// App lifecycle events
app.whenReady().then(async () => {
  let port = 3000;
  if (process.env.NODE_ENV !== 'development' && app.isPackaged) {
    try {
      port = await startNextServer();
    } catch (err) {
      console.error('Failed to start Next.js server:', err);
    }
  }

  createWindow(port)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  if (nextServerProcess) {
    nextServerProcess.kill()
  }
})

// IPC handlers for auth/messenger functionality
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('minimize-window', () => {
  mainWindow?.minimize()
})

ipcMain.handle('maximize-window', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('close-window', () => {
  mainWindow?.close()
})

// Start Vondic OAuth flow for desktop
ipcMain.handle('start-vondic-auth', async (event, options) => {
  const http = require('http');
  const client_id = process.env.VONDIC_OAUTH_CLIENT_ID || '46b766ec-96c9-473f-ab7e-b75dfb75f38a';
  const client_secret = process.env.VONDIC_OAUTH_CLIENT_SECRET || '0741e349-b77c-47ac-878d-e9cfb47ea80ce6ab57139e4e46888d4d3ec9d57705d1';
  const redirect_uri = 'http://localhost:65432/callback';
  const state = require('crypto').randomBytes(16).toString('hex');

  const backendUrl = process.env.VONDIC_BACKEND_URL || 'https://api.vondic.ru';
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://vondic.ru';

  const authUrl = `${frontendUrl}/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&state=${state}`;

  console.log(`Starting Vondic OAuth flow. Auth URL: ${authUrl}`);

  return new Promise((resolve) => {
    let authWindow = null;
    let server = null;

    const cleanup = () => {
      if (server) {
        server.close();
        server = null;
      }
      if (authWindow) {
        authWindow.destroy();
        authWindow = null;
      }
    };

    server = http.createServer(async (req, res) => {
      // Parse URL
      const urlObj = new URL(req.url, 'http://localhost:65432');
      if (urlObj.pathname === '/callback') {
        const code = urlObj.searchParams.get('code');
        const returnedState = urlObj.searchParams.get('state');

        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>Ошибка: Неверный параметр state.</h1>');
          resolve({ success: false, error: 'State verification failed' });
          cleanup();
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>Ошибка: Код авторизации не найден.</h1>');
          resolve({ success: false, error: 'Authorization code missing' });
          cleanup();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Вход выполнен успешно! Вы можете закрыть это окно.</h1>');

        // Exchange code for token
        try {
          console.log(`Exchanging code for token with ${backendUrl}/oauth/token...`);
          const bodyParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirect_uri,
            client_id: client_id,
            client_secret: client_secret
          });

          const tokenResponse = await net.fetch(`${frontendUrl}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: bodyParams.toString()
          });

          if (!tokenResponse.ok) {
            const errText = await tokenResponse.text();
            throw new Error(`Token exchange failed: ${errText}`);
          }

          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;

          // Fetch user info
          console.log(`Fetching user info with access token from ${frontendUrl}/oauth/userinfo...`);
          const userResponse = await net.fetch(`${frontendUrl}/oauth/userinfo`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });

          if (!userResponse.ok) {
            const errText = await userResponse.text();
            throw new Error(`User info request failed: ${errText}`);
          }

          const userData = await userResponse.json();

          resolve({
            success: true,
            user: {
              ...userData,
              access_token: accessToken,
              refresh_token: accessToken
            }
          });
        } catch (err) {
          console.error('OAuth token exchange error:', err);
          resolve({ success: false, error: `Authentication failed: ${err.message}` });
        } finally {
          // Delay cleanup so browser finishes loading success text
          setTimeout(cleanup, 1000);
        }
      }
    });

    server.listen(65432, '127.0.0.1', (err) => {
      if (err) {
        console.error('Failed to start OAuth callback server:', err);
        resolve({ success: false, error: `Failed to start local callback server: ${err.message}` });
        cleanup();
        return;
      }

      // Open OAuth window
      authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        title: 'Авторизация Вондик',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // Strip Content Security Policy headers to bypass server-side CSP form-action restriction
      authWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders };
        for (const headerName of Object.keys(responseHeaders)) {
          if (headerName.toLowerCase() === 'content-security-policy') {
            delete responseHeaders[headerName];
          }
        }
        callback({ cancel: false, responseHeaders });
      });

      authWindow.loadURL(authUrl);

      authWindow.on('closed', () => {
        if (server) {
          resolve({ success: false, error: 'Вход отменен пользователем' });
          cleanup();
        }
      });
    });
  });
});

