const { contextBridge } = require('electron');
const path = require('path');

// Load modules - with sandbox: false, we should have full Node.js access
let axios, XLSX;

try {
  // In packaged app, modules might be in different location
  // Try to require from app.asar or unpacked location
  try {
    axios = require('axios');
    XLSX = require('xlsx');
  } catch (err) {
    // If direct require fails, try from app path
    const appPath = process.env.APP_PATH || __dirname;
    const nodeModulesPath = path.join(appPath, '..', 'node_modules');
    axios = require(path.join(nodeModulesPath, 'axios'));
    XLSX = require(path.join(nodeModulesPath, 'xlsx'));
  }
  
  console.log('[Preload] ✓ Modules loaded successfully');
  console.log('[Preload] axios type:', typeof axios);
  console.log('[Preload] axios.get type:', typeof axios.get);
  
  // contextBridge uses structured cloning which can't serialize complex objects
  // So we need to expose wrapper functions instead of the objects themselves
  contextBridge.exposeInMainWorld('electronAPI', {
    // Expose axios methods as wrapper functions
    axios: {
      get: (url, config) => axios.get(url, config),
      post: (url, data, config) => axios.post(url, data, config),
      put: (url, data, config) => axios.put(url, data, config),
      delete: (url, config) => axios.delete(url, config),
      request: (config) => axios.request(config),
      create: (config) => axios.create(config)
    },
    // Expose XLSX - expose the whole object since it's needed
    // We'll expose it as a proxy that forwards method calls
    XLSX: XLSX  // Try exposing the whole object - might work with sandbox: false
  });
  
  console.log('[Preload] ✓ electronAPI exposed successfully');
} catch (error) {
  console.error('[Preload] ✗ Error loading modules:', error.message);
  console.error('[Preload] Error code:', error.code);
  console.error('[Preload] Error stack:', error.stack);
  
  // Expose error to renderer
  contextBridge.exposeInMainWorld('electronAPI', {
    error: 'Failed to load modules: ' + error.message,
    errorCode: error.code
  });
}

