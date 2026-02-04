const { app, BrowserWindow } = require('electron');
const path = require('path');

// Suppress graphics driver warnings (harmless but noisy on Linux)
// These warnings don't affect functionality but clutter the console
app.commandLine.appendSwitch('disable-gpu-vulkan');

// Suppress libva and Vulkan errors by filtering stderr
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
    return true; // Suppress these specific errors
  }
  return originalStderrWrite(chunk, encoding, fd);
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false  // Disable sandbox to allow Node.js modules in preload
    },
    icon: path.join(__dirname, 'assets', 'icon.png'), // Will use icon.ico for Windows builds
    title: 'Point of Sale System'
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

