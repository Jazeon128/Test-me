# FlashLearn Desktop - Setup Guide

This guide will help you set up the development environment for the FlashLearn desktop application.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or later
- **npm** 9.x or later
- **Python** 3.9 or later (for backend development)
- **Git**

## Initial Setup

### 1. Install Electron Dependencies

```bash
cd electron
npm install
```

This will install:
- Electron framework
- electron-builder (for packaging)
- electron-store (for settings storage)
- electron-updater (for auto-updates)
- Development dependencies

### 2. Verify Installation

Check that Electron is installed correctly:

```bash
npx electron --version
```

You should see the Electron version number (e.g., `v28.0.0`).

## Development Workflow

### Running in Development Mode

The development workflow requires two processes:

1. **Frontend Dev Server** (Vite)
2. **Electron Application**

#### Option 1: Automatic (Recommended)

The `dev` script will check if the frontend dev server is running and start Electron:

```bash
# Terminal 1: Start frontend dev server
cd ../frontend
npm run dev

# Terminal 2: Start Electron (will wait for frontend)
cd ../electron
npm run dev
```

#### Option 2: Manual

If you prefer more control:

```bash
# Terminal 1: Frontend
cd ../frontend
npm run dev

# Terminal 2: Electron
cd ../electron
npm run dev:direct
```

### Development Features

When running in development mode:
- Hot reload for frontend changes (via Vite)
- DevTools automatically open
- Loads from `http://localhost:5173`
- Console logs visible in terminal

## Building the Application

### Prerequisites for Building

Before building, you need:

1. **Built Frontend**
   ```bash
   cd ../frontend
   npm run build
   cp -r dist/* ../electron/renderer/
   ```

2. **Bundled Backend** (will be implemented in later tasks)
   ```bash
   cd ../backend
   # PyInstaller build commands (TBD)
   ```

### Build Commands

Build for your current platform:
```bash
npm run build
```

Build for specific platforms:
```bash
npm run build:win     # Windows (requires Windows or Wine)
npm run build:mac     # macOS (requires macOS)
npm run build:linux   # Linux
```

### Build Output

Built applications will be in the `dist/` directory:

- **Windows**: `FlashLearn-{version}-x64.exe` (installer) and portable exe
- **macOS**: `FlashLearn-{version}-x64.dmg` and `FlashLearn-{version}-arm64.dmg`
- **Linux**: `FlashLearn-{version}-x64.AppImage`, `.deb`, and `.rpm`

### Testing Builds

To test the packaging without creating installers:

```bash
npm run pack
```

This creates an unpacked build in `dist/` that you can run directly.

## Project Structure

```
electron/
├── main/              # Main process (Node.js)
│   └── index.js       # Entry point, window management
├── preload/           # Preload scripts
│   └── index.js       # Secure IPC bridge
├── renderer/          # Frontend (built from ../frontend)
├── backend/           # Python backend (built from ../backend)
├── build/             # Build resources (icons)
├── dev-runner.js      # Development helper script
├── package.json       # Dependencies and build config
└── README.md          # Documentation
```

## Troubleshooting

### "Frontend dev server not available"

Make sure the frontend dev server is running:
```bash
cd ../frontend
npm run dev
```

Wait for the message: `Local: http://localhost:5173/`

### "electron: command not found"

Install dependencies:
```bash
npm install
```

### Build fails with "Cannot find module"

Run postinstall script:
```bash
npm run postinstall
```

### Windows build fails on macOS/Linux

Cross-platform building has limitations. Use:
- Windows builds: Requires Windows or Wine
- macOS builds: Requires macOS
- Linux builds: Can be built on any platform

### "Application is damaged" on macOS

This happens when the app isn't code-signed. For development:
```bash
xattr -cr /path/to/FlashLearn.app
```

For production, configure code signing in `package.json`.

## Next Steps

After setting up the Electron project:

1. Implement Backend Process Manager (Task 2)
2. Implement Main Process features (Task 3)
3. Implement Settings Manager (Task 4)
4. Update Frontend for Electron (Task 7)
5. Bundle Python Backend (Task 12)
6. Configure packaging (Task 13)

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder Documentation](https://www.electron.build/)
- [Electron Security Best Practices](https://www.electronjs.org/docs/tutorial/security)
