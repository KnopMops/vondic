const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getYandexAuthUrl: () => ipcRenderer.invoke('get-yandex-auth-url'),
  authWithApiKey: (apiKey, cloudPassword) => 
    ipcRenderer.invoke('auth-api-key', { apiKey, cloudPassword }),
  startYandexOAuth: () => ipcRenderer.invoke('start-yandex-oauth'),
  getUserInfo: (accessToken) => ipcRenderer.invoke('get-user-info', accessToken),
});
