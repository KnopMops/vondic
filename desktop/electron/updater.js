const { app, dialog, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const https = require('https')
const { spawn } = require('child_process')
const fetch = require('node-fetch')

const YANDEX_DISK_PUBLIC_URL = 'https://disk.yandex.ru/i/-H5OlMbZjYsA3Q'
const GITHUB_REPO = 'KnopMops/vondic'
const GITHUB_RELEASE_TAG = 'vondic-desktop'

let updateInProgress = false

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'Vondic-Desktop-Updater',
            Accept: 'application/json',
          },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return httpsGetJson(res.headers.location).then(resolve).catch(reject)
          }
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            try {
              resolve(JSON.parse(data))
            } catch (e) {
              reject(new Error('Invalid JSON response'))
            }
          })
        },
      )
      .on('error', reject)
  })
}

function httpsGetText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'Vondic-Desktop-Updater',
          },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return httpsGetText(res.headers.location).then(resolve).catch(reject)
          }
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => resolve(data))
        },
      )
      .on('error', reject)
  })
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'Vondic-Desktop-Updater',
          },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            file.close()
            fs.unlink(dest, () => {})
            return downloadFile(res.headers.location, dest, onProgress)
              .then(resolve)
              .catch(reject)
          }
          if (res.statusCode !== 200) {
            file.close()
            fs.unlink(dest, () => {})
            return reject(new Error(`Download failed: ${res.statusCode}`))
          }

          const total = parseInt(res.headers['content-length'], 10) || 0
          let downloaded = 0

          res.on('data', (chunk) => {
            downloaded += chunk.length
            if (total && onProgress) {
              onProgress(Math.round((downloaded / total) * 100))
            }
          })
          res.pipe(file)
          file.on('finish', () => {
            file.close(resolve)
          })
        },
      )
      .on('error', (err) => {
        fs.unlink(dest, () => {})
        reject(err)
      })
  })
}

async function getLatestVersionFromYandexDisk() {
  const metaUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(
    YANDEX_DISK_PUBLIC_URL,
  )}`
  const meta = await httpsGetJson(metaUrl)
  if (!meta || !meta.href) {
    throw new Error('Failed to get download URL from Yandex Disk')
  }
  const text = await httpsGetText(meta.href)
  return text.trim()
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

async function getGitHubRelease() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${GITHUB_RELEASE_TAG}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Vondic-Desktop-Updater',
      Accept: 'application/vnd.github.v3+json',
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }
  return response.json()
}

function findBestAsset(assets) {
  const platform = process.platform
  const arch = process.arch

  // Try to find platform-specific asset first
  const patterns = []
  if (platform === 'win32') {
    patterns.push(/win.*\.zip$/i)
    patterns.push(/windows.*\.zip$/i)
    patterns.push(/\.exe$/i)
    patterns.push(/portable\.zip$/i)
  } else if (platform === 'darwin') {
    patterns.push(/mac.*\.zip$/i)
    patterns.push(/darwin.*\.zip$/i)
    patterns.push(/\.dmg$/i)
    patterns.push(/portable\.zip$/i)
  } else {
    patterns.push(/linux.*\.zip$/i)
    patterns.push(/AppImage$/i)
    patterns.push(/portable\.zip$/i)
  }

  for (const pattern of patterns) {
    const asset = assets.find((a) => pattern.test(a.name))
    if (asset) return asset
  }

  // Fallback: any zip file
  return assets.find((a) => /\.zip$/i.test(a.name))
}

function getAppRootDir() {
  // In packaged app, exe is in a subfolder (e.g. Vondic/resources/app)
  // We want the root folder containing the exe
  const exeDir = path.dirname(app.getPath('exe'))
  if (process.platform === 'darwin') {
    // macOS: Vondic.app/Contents/MacOS/Vondic -> Vondic.app/Contents
    return path.resolve(exeDir, '..')
  }
  return exeDir
}

async function extractUpdate(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'
    const cmd = isWindows ? 'powershell' : 'unzip'
    const args = isWindows
      ? ['-Command', `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`]
      : ['-o', zipPath, '-d', destDir]

    const proc = spawn(cmd, args, { stdio: 'ignore' })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Extract failed with code ${code}`))
    })
    proc.on('error', (err) => reject(err))
  })
}

function createAndRunUpdaterScript(updateDir, appDir, exePath) {
  const isWindows = process.platform === 'win32'
  const isMac = process.platform === 'darwin'

  if (isWindows) {
    const batPath = path.join(app.getPath('temp'), `vondic-update-${Date.now()}.bat`)
    const batContent = `
@echo off
timeout /t 2 /nobreak >nul
xcopy /E /Y /I "${updateDir.replace(/"/g, '\\"')}"\* "${appDir.replace(/"/g, '\\"')}"\nif exist "${updateDir.replace(/"/g, '\\"')}" rmdir /S /Q "${updateDir.replace(/"/g, '\\"')}"\ndel "%~f0"\nstart "" "${exePath.replace(/"/g, '\\"')}"\n`
    fs.writeFileSync(batPath, batContent, 'utf8')
    spawn('cmd', ['/c', batPath], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    })
  } else {
    const shPath = path.join(app.getPath('temp'), `vondic-update-${Date.now()}.sh`)
    const shContent = `#!/bin/bash
sleep 2
if command -v rsync &> /dev/null; then
  rsync -a --delete "${updateDir}/" "${appDir}/"
else
  cp -R "${updateDir}/"* "${appDir}/"
fi
rm -rf "${updateDir}"
rm "${shPath}"
"${exePath}" &
`
    fs.writeFileSync(shPath, shContent, { mode: 0o755 })
    spawn('bash', [shPath], {
      detached: true,
      stdio: 'ignore',
    })
  }
}

async function performUpdate(parentWindow) {
  if (updateInProgress) return
  updateInProgress = true

  let progressWindow = null
  try {
    const release = await getGitHubRelease()
    const asset = findBestAsset(release.assets || [])
    if (!asset) {
      throw new Error('No suitable update asset found')
    }

    // Show progress window
    progressWindow = new BrowserWindow({
      width: 400,
      height: 150,
      parent: parentWindow,
      modal: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })
    progressWindow.setMenuBarVisibility(false)
    progressWindow.loadURL(
      `data:text/html,<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;text-align:center;padding:30px;}progress{width:80%%;}</style></head><body><h3>Загрузка обновления...</h3><progress id="p" value="0" max="100"></progress><p id="t">0%%</p></body></html>`,
    )

    const zipName = `vondic-update-${Date.now()}.zip`
    const zipPath = path.join(app.getPath('temp'), zipName)

    await downloadFile(
      asset.browser_download_url,
      zipPath,
      (percent) => {
        if (progressWindow && !progressWindow.isDestroyed()) {
          progressWindow.webContents
            .executeJavaScript(
              `document.getElementById('p').value = ${percent}; document.getElementById('t').textContent = '${percent}%';`,
            )
            .catch(() => {})
        }
      },
    )

    if (progressWindow && !progressWindow.isDestroyed()) {
      progressWindow.close()
      progressWindow = null
    }

    // Extract to update dir
    const appDir = getAppRootDir()
    const updateDir = path.join(path.dirname(appDir), `vondic-update-${Date.now()}`)

    await extractUpdate(zipPath, updateDir)

    // Clean up zip
    fs.unlink(zipPath, () => {})

    const result = await dialog.showMessageBox(parentWindow || undefined, {
      type: 'info',
      title: 'Обновление готово',
      message: 'Обновление загружено и готово к установке.',
      detail: 'Приложение будет перезапущено для применения обновления.',
      buttons: ['Перезапустить сейчас', 'Позже'],
      defaultId: 0,
      cancelId: 1,
    })

    if (result.response === 0) {
      const exePath = app.getPath('exe')
      createAndRunUpdaterScript(updateDir, appDir, exePath)
      app.quit()
    } else {
      // Clean up update dir if user cancelled
      fs.rm(updateDir, { recursive: true, force: true }, () => {})
    }
  } catch (error) {
    console.error('[Updater] Update failed:', error)
    if (progressWindow && !progressWindow.isDestroyed()) {
      progressWindow.close()
    }
    dialog.showErrorBox(
      'Ошибка обновления',
      `Не удалось загрузить или установить обновление:\n${error.message}`,
    )
  } finally {
    updateInProgress = false
  }
}

async function checkAndPrompt(parentWindow) {
  try {
    const remoteVersion = await getLatestVersionFromYandexDisk()
    const currentVersion = app.getVersion()

    console.log(`[Updater] Current version: ${currentVersion}, Remote version: ${remoteVersion}`)

    if (compareVersions(remoteVersion, currentVersion) <= 0) {
      console.log('[Updater] No update available')
      return
    }

    const result = await dialog.showMessageBox(parentWindow || undefined, {
      type: 'info',
      title: 'Доступно обновление',
      message: `Доступна новая версия Vondic: ${remoteVersion}`,
      detail: `Текущая версия: ${currentVersion}\nНовая версия: ${remoteVersion}\n\nХотите загрузить и установить обновление сейчас?`,
      buttons: ['Загрузить и установить', 'Позже'],
      defaultId: 0,
      cancelId: 1,
    })

    if (result.response === 0) {
      await performUpdate(parentWindow)
    }
  } catch (error) {
    console.error('[Updater] Check failed:', error)
  }
}

function initUpdater(mainWindow) {
  // Check for updates 5 seconds after app start
  setTimeout(() => {
    checkAndPrompt(mainWindow)
  }, 5000)
}

module.exports = { initUpdater, checkAndPrompt }
