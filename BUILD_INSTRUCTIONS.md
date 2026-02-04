# Building Windows Executable

## Prerequisites

1. **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
2. **npm** (comes with Node.js)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install electron-builder and all other dependencies.

### 2. Build for Windows

#### Option A: Build Installer (NSIS) - Recommended
```bash
npm run build:win
```

This creates:
- **Installer**: `dist/POS System Setup 1.0.0.exe` (for installation)
- **Portable**: `dist/POS System 1.0.0.exe` (standalone executable)

#### Option B: Build 64-bit Only
```bash
npm run build:win64
```

#### Option C: Build 32-bit Only
```bash
npm run build:win32
```

### 3. Output Location

All built files will be in the `dist/` folder:
- `POS System Setup 1.0.0.exe` - Windows installer
- `POS System 1.0.0.exe` - Portable executable (no installation needed)

## Building on Different Platforms

### On Windows:
```bash
npm run build:win
```

### On Linux (Cross-compile for Windows):
```bash
npm run build:win
```

### On macOS (Cross-compile for Windows):
```bash
npm run build:win
```

## Notes

- The first build may take longer as it downloads Electron binaries
- The installer allows users to choose installation directory
- The portable version can run without installation
- If you have an icon file (`assets/icon.ico`), it will be used automatically
- Without an icon, a default Electron icon will be used

## Troubleshooting

### If build fails:
1. Make sure all dependencies are installed: `npm install`
2. Check Node.js version: `node --version` (should be v16+)
3. Try cleaning and rebuilding:
   ```bash
   rm -rf dist node_modules
   npm install
   npm run build:win
   ```

### Icon Issues:
- Create `assets/icon.ico` (256x256 or 512x512) for Windows
- Or remove the icon line from package.json build config

## Distribution

After building:
1. Test the installer on a Windows machine
2. Test the portable executable
3. Distribute the `.exe` file(s) from the `dist/` folder

