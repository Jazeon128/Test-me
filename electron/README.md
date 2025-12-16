# FlashLearn Desktop - Electron Application

This directory contains the Electron desktop application for FlashLearn.

## Directory Structure

```
electron/
├── main/           # Main process (Node.js)
│   └── index.js    # Application entry point
├── preload/        # Preload scripts (secure IPC bridge)
│   └── index.js    # IPC API exposure
├── renderer/       # Renderer process (React UI)
│   └── (built frontend files)
├── backend/        # Bundled Python backend
│   └── (PyInstaller output)
├── build/          # Build resources (icons, etc.)
└── package.json    # Electron dependencies and build config
```

## Development

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+ (for backend development)

### Setup

1. Install dependencies:
```bash
cd electron
npm install
```

2. Build the frontend:
```bash
cd ../frontend
npm run build
# Copy dist/ contents to electron/renderer/
```

3. Run in development mode:
```bash
npm run dev
```

This will start Electron and load the frontend from the Vite dev server at http://localhost:5173.

### Building

Build for all platforms:
```bash
npm run build
```

Build for specific platforms:
```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

Output will be in the `dist/` directory.

## Scripts

- `npm start` - Run Electron in production mode
- `npm run dev` - Run Electron in development mode (loads from Vite dev server)
- `npm run build` - Build for all platforms
- `npm run build:win` - Build for Windows only
- `npm run build:mac` - Build for macOS only
- `npm run build:linux` - Build for Linux only
- `npm run pack` - Package without creating installers (for testing)

## Configuration

The build configuration is in `package.json` under the `build` key. This uses electron-builder for packaging.

### Key Configuration Options

- **appId**: Unique application identifier
- **productName**: Display name of the application
- **files**: Files to include in the build
- **extraResources**: Additional resources (backend executable)
- **win/mac/linux**: Platform-specific build options

## IPC Communication

The preload script (`preload/index.js`) exposes a secure API to the renderer process via `window.electronAPI`:

- `openFileDialog()` - Open native file picker
- `openSettings()` - Open settings window
- `getLogs()` - Retrieve application logs
- `getAppInfo()` - Get version and system info
- `quitApp()` - Quit the application

## Backend Integration

The Python backend will be bundled using PyInstaller and included in the `backend/` directory. The main process will spawn and manage this backend process.

## Code Signing

For production releases, you'll need to configure code signing:

- **Windows**: Authenticode certificate
- **macOS**: Apple Developer certificate + notarization
- **Linux**: No signing required

See electron-builder documentation for details on configuring code signing.
