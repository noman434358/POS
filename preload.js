const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

let axios, XLSX;

try {
  try {
    axios = require('axios');
    XLSX = require('xlsx');
  } catch (err) {
    const appPath = process.env.APP_PATH || __dirname;
    const nodeModulesPath = path.join(appPath, '..', 'node_modules');
    axios = require(path.join(nodeModulesPath, 'axios'));
    XLSX = require(path.join(nodeModulesPath, 'xlsx'));
  }

  console.log('[Preload] ✓ Modules loaded successfully');

  contextBridge.exposeInMainWorld('electronAPI', {
    axios: {
      get: (url, config) => axios.get(url, config),
      post: (url, data, config) => axios.post(url, data, config),
      put: (url, data, config) => axios.put(url, data, config),
      delete: (url, config) => axios.delete(url, config),
      request: (config) => axios.request(config),
      create: (config) => axios.create(config)
    },
    XLSX: XLSX,
    storage: {
      read: (filename) => ipcRenderer.invoke('storage:read', filename),
      write: (filename, data) => ipcRenderer.invoke('storage:write', filename, data),
      getUserDataPath: () => ipcRenderer.invoke('storage:getUserDataPath')
    }
  });

  console.log('[Preload] ✓ electronAPI exposed successfully');
} catch (error) {
  console.error('[Preload] ✗ Error loading modules:', error.message);
  contextBridge.exposeInMainWorld('electronAPI', {
    error: 'Failed to load modules: ' + error.message,
    errorCode: error.code
  });
}
