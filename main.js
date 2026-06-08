const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Suppress graphics driver warnings
app.commandLine.appendSwitch('disable-gpu-vulkan');

const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = function(chunk, encoding, fd) {
  if (typeof chunk === 'string' && (
    chunk.includes('libva error') ||
    chunk.includes('vaGetDriverNameByIndex') ||
    chunk.includes('vkCreateInstance') ||
    chunk.includes('VulkanError') ||
    chunk.includes('Warning: loader_') ||
    chunk.includes('Warning: /usr/lib/x86_64-linux-gnu/libvulkan')
  )) {
    return true;
  }
  return originalStderrWrite(chunk, encoding, fd);
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    icon: path.join(__dirname, 'logo.png'),
    title: 'Point of Sale System'
  });

  mainWindow.loadFile('index.html');

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// File-based storage handlers (userData directory, survives app updates)
ipcMain.handle('storage:read', async (event, filename) => {
  try {
    const filePath = path.join(app.getPath('userData'), filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
  } catch (e) {
    console.error('[Storage] Read error:', e.message);
    return null;
  }
});

ipcMain.handle('storage:write', async (event, filename, data) => {
  try {
    const filePath = path.join(app.getPath('userData'), filename);
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
    return true;
  } catch (e) {
    console.error('[Storage] Write error:', e.message);
    return false;
  }
});

ipcMain.handle('storage:getUserDataPath', async () => {
  return app.getPath('userData');
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
