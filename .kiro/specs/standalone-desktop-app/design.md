# Design Document

## Overview

This design document outlines the architecture for converting FlashLearn from a web application into a standalone desktop application. We will use **Electron** as the desktop framework, which allows us to bundle the React frontend, FastAPI backend, and SQLite database into a single native application for Windows, macOS, and Linux.

Electron was chosen because:
- It supports our existing React/Vite frontend with minimal changes
- It provides native OS integration (system tray, menus, notifications)
- It has mature tooling for packaging and auto-updates (electron-builder)
- It can spawn and manage the Python backend process
- It has a large ecosystem and community support

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Electron Main Process                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │  - Window Management                                │ │
│  │  - System Tray                                      │ │
│  │  - Backend Process Manager                          │ │
│  │  - IPC Handler                                      │ │
│  │  - Auto-updater                                     │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         │                                    │
         │ IPC                                │ Spawns/Manages
         │                                    │
         ▼                                    ▼
┌──────────────────────┐          ┌──────────────────────┐
│  Renderer Process    │          │   Python Backend     │
│  (React Frontend)    │◄────────►│   (FastAPI)          │
│                      │   HTTP   │                      │
│  - Vite Build        │          │  - Bundled with      │
│  - Existing UI       │          │    PyInstaller       │
└──────────────────────┘          └──────────────────────┘
                                           │
                                           │
                                           ▼
                                  ┌──────────────────────┐
                                  │   SQLite Database    │
                                  │   (User Data Dir)    │
                                  └──────────────────────┘
```


### Process Architecture

1. **Electron Main Process**: Node.js process that manages the application lifecycle, windows, and native OS features
2. **Renderer Process**: Chromium process that renders the React UI
3. **Backend Process**: Bundled Python executable running the FastAPI server

### Communication Flow

1. User interacts with React UI in Renderer Process
2. UI makes HTTP requests to localhost backend (FastAPI)
3. For native features (file dialogs, system tray), Renderer uses IPC to communicate with Main Process
4. Main Process manages Backend Process lifecycle (start, stop, restart)

## Components and Interfaces

### 1. Electron Main Process (`electron/main.js`)

**Responsibilities:**
- Create and manage application windows
- Spawn and monitor the Python backend process
- Handle system tray icon and menu
- Manage IPC communication with renderer
- Handle auto-updates
- Manage application lifecycle events

**Key APIs:**
- `BrowserWindow`: Create and manage windows
- `Tray`: System tray icon and menu
- `ipcMain`: Inter-process communication
- `app`: Application lifecycle
- `dialog`: Native dialogs
- `autoUpdater`: Automatic updates

### 2. Backend Process Manager (`electron/backend-manager.js`)

**Responsibilities:**
- Locate bundled Python executable
- Spawn backend process with correct environment
- Monitor backend health (HTTP health checks)
- Handle backend crashes and restarts
- Gracefully shutdown backend on app quit

**Interface:**
```javascript
class BackendManager {
  constructor(userDataPath)
  async start(): Promise<number> // Returns port
  async stop(): Promise<void>
  async restart(): Promise<void>
  isRunning(): boolean
  getPort(): number
}
```

### 3. IPC Bridge (`electron/ipc-handlers.js`)

**Responsibilities:**
- Handle IPC messages from renderer
- Provide native file dialogs
- Expose settings management
- Provide log access

**IPC Channels:**
- `open-file-dialog`: Open native file picker
- `open-settings`: Open settings window
- `get-logs`: Retrieve application logs
- `get-app-info`: Get version and system info
- `quit-app`: Quit application


### 4. Settings Manager (`electron/settings-manager.js`)

**Responsibilities:**
- Store and retrieve user settings
- Encrypt sensitive data (API keys)
- Provide settings validation

**Interface:**
```javascript
class SettingsManager {
  constructor(userDataPath)
  get(key: string): any
  set(key: string, value: any): void
  getSecure(key: string): string // For API keys
  setSecure(key: string, value: string): void
  getAll(): object
  reset(): void
}
```

**Storage Location:**
- Windows: `%APPDATA%/FlashLearn/settings.json`
- macOS: `~/Library/Application Support/FlashLearn/settings.json`
- Linux: `~/.config/FlashLearn/settings.json`

### 5. Frontend Modifications (`frontend/`)

**Changes Required:**
- Add Electron preload script for IPC
- Update API base URL to use dynamic backend port
- Add native file picker integration
- Add settings UI for API keys
- Update build configuration for Electron

**New Components:**
- `SettingsDialog.jsx`: UI for configuring API keys and preferences
- `AboutDialog.jsx`: Display version and system information
- `LogViewer.jsx`: View application logs

### 6. Backend Bundling

**Approach:** Use PyInstaller to create standalone Python executable

**Configuration:**
- Bundle all Python dependencies
- Include FastAPI, SQLite, and document parsers
- Exclude development dependencies (pytest, black, etc.)
- Set up proper entry point for uvicorn server

**PyInstaller Spec:**
```python
# backend.spec
a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[('app', 'app')],
    hiddenimports=['uvicorn', 'sqlalchemy', 'pdfplumber'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pytest', 'black', 'mypy'],
)
```

## Data Models

### Application State

```typescript
interface AppState {
  backendPort: number;
  backendStatus: 'starting' | 'running' | 'stopped' | 'error';
  settings: AppSettings;
  updateAvailable: boolean;
}

interface AppSettings {
  apiProvider: 'openai' | 'anthropic' | 'google';
  apiKeys: {
    openai?: string;
    anthropic?: string;
    google?: string;
  };
  theme: 'light' | 'dark' | 'system';
  autoUpdate: boolean;
  minimizeToTray: boolean;
}
```

### IPC Messages

```typescript
// Renderer -> Main
interface IPCRequest {
  channel: string;
  data?: any;
}

// Main -> Renderer
interface IPCResponse {
  success: boolean;
  data?: any;
  error?: string;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Application Lifecycle Properties

**Property 1: Backend startup invariant**
*For any* application launch, starting the application should result in both the backend process running and the main window being displayed.
**Validates: Requirements 1.2**

**Property 2: Database initialization**
*For any* first launch of the application, the SQLite database file should exist in the user's application data directory after startup completes.
**Validates: Requirements 1.3**

**Property 3: Data persistence round-trip**
*For any* data created in one application session, restarting the application should make that data available in the new session.
**Validates: Requirements 3.4**

**Property 4: Settings persistence round-trip**
*For any* settings configured in one application session, restarting the application should restore those settings in the new session.
**Validates: Requirements 3.5**

### Window Management Properties

**Property 5: Window close to tray**
*For any* running application, closing the main window should result in the window being hidden, the system tray icon being visible, and the application process still running.
**Validates: Requirements 2.2**

**Property 6: Tray icon restore**
*For any* application minimized to tray, clicking the tray icon should make the main window visible again.
**Validates: Requirements 2.3**

**Property 7: Window controls presence**
*For any* application window, the window should have functional minimize, maximize, and close controls.
**Validates: Requirements 2.1**

### Data Storage Properties

**Property 8: File upload location**
*For any* file uploaded through the application, the file should be stored in the application data directory.
**Validates: Requirements 3.3**

**Property 9: Database location**
*For any* data modification operation, the SQLite database should be located in the application data directory.
**Validates: Requirements 3.2**

**Property 10: Data directory creation**
*For any* first launch, the application should create the data directory in the OS-standard location for application data.
**Validates: Requirements 3.1**

### Settings and Configuration Properties

**Property 11: API key validation**
*For any* string that is not a valid API key format, attempting to save it as an API key should be rejected with an error.
**Validates: Requirements 4.2**

**Property 12: API key secure storage**
*For any* API key saved through the settings dialog, the key should be stored in an encrypted or obfuscated form in the settings file.
**Validates: Requirements 4.3**

**Property 13: Missing API key handling**
*For any* application start without configured API keys, AI-dependent features should be disabled and appropriate messaging should be displayed.
**Validates: Requirements 4.5**

**Property 14: Settings dialog availability**
*For any* running application, opening settings should display a dialog with fields for configuring API keys.
**Validates: Requirements 4.1**

### Error Handling Properties

**Property 15: Backend failure handling**
*For any* backend startup failure, the application should display an error dialog with troubleshooting information.
**Validates: Requirements 6.1**

**Property 16: API error messaging**
*For any* AI API error response, the application should display a user-friendly error message with suggested actions.
**Validates: Requirements 6.3**

**Property 17: Error logging**
*For any* unexpected error that occurs, the error details should be written to the log file in the application data directory.
**Validates: Requirements 6.4**

### Performance Properties

**Property 18: Splash screen timing**
*For any* application launch, the splash screen should appear within 1 second of the executable being started.
**Validates: Requirements 8.1**

**Property 19: Main window timing**
*For any* application launch on modern hardware, the main window should be displayed within 3 seconds of startup.
**Validates: Requirements 8.2**

**Property 20: Window restoration timing**
*For any* application already running, restoring the window from the tray should complete within 500 milliseconds.
**Validates: Requirements 8.3**

### Keyboard Shortcut Properties

**Property 21: Shortcut consistency**
*For any* keyboard shortcut defined in the application, pressing that shortcut should trigger the associated action.
**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

### Update Properties

**Property 22: Update check on startup**
*For any* application launch, an update check request should be made to the release server.
**Validates: Requirements 5.1**

**Property 23: Update notification**
*For any* available update, the application should display an update notification to the user.
**Validates: Requirements 5.2**

**Property 24: Update reminder**
*For any* declined update, the application should display a reminder on the next startup.
**Validates: Requirements 5.5**

### Logging and Diagnostics Properties

**Property 25: Log viewer availability**
*For any* running application, the help menu should contain an option to view logs, and selecting it should display a log viewer dialog.
**Validates: Requirements 9.1, 9.2**

**Property 26: Diagnostic report completeness**
*For any* diagnostic report generated, it should include the application version, operating system information, and current configuration.
**Validates: Requirements 9.3**

**Property 27: Log export**
*For any* log export operation, a log file should be created at the user-selected location.
**Validates: Requirements 9.4**

**Property 28: Error detail logging**
*For any* error that occurs, the log file should contain the error message, stack trace, and relevant context.
**Validates: Requirements 9.5**


## Error Handling

### Backend Process Errors

**Startup Failures:**
- Port already in use: Try alternative ports (8000-8010)
- Python executable not found: Display error with instructions to reinstall
- Database initialization failure: Offer to reset database

**Runtime Failures:**
- Backend crash: Automatically restart backend process
- Backend unresponsive: Display warning and offer to restart
- Health check timeout: Retry with exponential backoff

### Frontend Errors

**Network Errors:**
- Backend unreachable: Display connection error with retry option
- API timeout: Show timeout message with retry button
- Invalid response: Log error and show generic error message

**UI Errors:**
- Unhandled exceptions: Catch in error boundary, log, and show error dialog
- IPC failures: Fallback to HTTP API where possible
- Resource loading failures: Show placeholder and log error

### Data Errors

**Database Errors:**
- Corruption detected: Offer backup and reset
- Migration failures: Rollback and display error
- Disk full: Alert user and suggest cleanup

**File System Errors:**
- Permission denied: Request elevated permissions or suggest alternative location
- Disk full: Alert user with disk space information
- File not found: Handle gracefully and update UI state

### Update Errors

**Download Failures:**
- Network error: Retry with exponential backoff
- Checksum mismatch: Re-download update
- Insufficient disk space: Alert user

**Installation Failures:**
- Permission denied: Request elevation
- File in use: Prompt user to close application
- Corrupted update: Delete and re-download

## Testing Strategy

### Unit Testing

**Electron Main Process:**
- Test window creation and management
- Test IPC handler registration and responses
- Test backend process spawning and monitoring
- Test settings manager CRUD operations
- Test system tray menu creation

**Backend Manager:**
- Test process spawning with correct arguments
- Test health check logic
- Test graceful shutdown
- Test restart behavior
- Test port allocation

**Settings Manager:**
- Test get/set operations
- Test secure storage encryption
- Test settings validation
- Test default values
- Test settings migration

**Frontend Components:**
- Test SettingsDialog form validation
- Test LogViewer rendering
- Test AboutDialog information display
- Test IPC integration in components

### Property-Based Testing

We will use **fast-check** for JavaScript/TypeScript property-based testing and **Hypothesis** for Python backend testing. Each property-based test should run a minimum of 100 iterations.

**Property Test Requirements:**
- Each property-based test MUST be tagged with a comment referencing the correctness property from this design document
- Tag format: `// Feature: standalone-desktop-app, Property {number}: {property_text}`
- Each correctness property MUST be implemented by a SINGLE property-based test

**Test Coverage:**

1. **Application Lifecycle Tests:**
   - Property 1: Test that startup always results in backend running and window displayed
   - Property 2: Test database initialization on first launch
   - Property 3: Test data persistence across restarts
   - Property 4: Test settings persistence across restarts

2. **Window Management Tests:**
   - Property 5: Test window close to tray behavior
   - Property 6: Test tray icon restore
   - Property 7: Test window controls presence

3. **Data Storage Tests:**
   - Property 8: Test file upload location
   - Property 9: Test database location
   - Property 10: Test data directory creation

4. **Settings Tests:**
   - Property 11: Test API key validation rejects invalid formats
   - Property 12: Test API key encryption in storage
   - Property 13: Test feature gating without API keys
   - Property 14: Test settings dialog availability

5. **Error Handling Tests:**
   - Property 15: Test backend failure error dialog
   - Property 16: Test API error messaging
   - Property 17: Test error logging

6. **Performance Tests:**
   - Property 18: Test splash screen timing
   - Property 19: Test main window timing
   - Property 20: Test window restoration timing

7. **Keyboard Shortcut Tests:**
   - Property 21: Test all keyboard shortcuts trigger correct actions

8. **Update Tests:**
   - Property 22: Test update check on startup
   - Property 23: Test update notification
   - Property 24: Test update reminder

9. **Logging Tests:**
   - Property 25: Test log viewer availability
   - Property 26: Test diagnostic report completeness
   - Property 27: Test log export
   - Property 28: Test error detail logging

### Integration Testing

**End-to-End Tests:**
- Full application startup and shutdown
- Complete user workflow (upload document, generate questions, study)
- Settings configuration and persistence
- Update download and installation
- Error recovery scenarios

**Platform-Specific Tests:**
- Test on Windows 10/11
- Test on macOS 12+
- Test on Ubuntu 20.04+
- Test installer/package installation
- Test code signing verification

### Manual Testing

**User Experience:**
- First-run experience
- System tray interaction
- Native dialogs and menus
- Keyboard shortcuts
- Window management (minimize, maximize, fullscreen)

**Performance:**
- Startup time on various hardware
- Memory usage during normal operation
- CPU usage during AI generation
- Disk space usage

**Compatibility:**
- Different screen resolutions
- Multiple monitors
- High DPI displays
- Different OS versions

## Build and Packaging

### Build Pipeline

```
1. Frontend Build (Vite)
   ├─> Bundle React app
   ├─> Optimize assets
   └─> Output to electron/renderer/

2. Backend Build (PyInstaller)
   ├─> Bundle Python + dependencies
   ├─> Create standalone executable
   └─> Output to electron/backend/

3. Electron Build (electron-builder)
   ├─> Package frontend + backend
   ├─> Create installers
   ├─> Code sign executables
   └─> Output platform-specific packages
```

### Platform-Specific Configurations

**Windows:**
- Target: Windows 10 and later
- Output: NSIS installer (.exe) and portable executable
- Code signing: Authenticode certificate
- Icon: .ico format

**macOS:**
- Target: macOS 12 (Monterey) and later
- Output: DMG disk image and .app bundle
- Code signing: Apple Developer certificate
- Notarization: Required for Gatekeeper
- Icon: .icns format

**Linux:**
- Target: Ubuntu 20.04+ and equivalent
- Output: AppImage, .deb, .rpm
- Icon: .png format (multiple sizes)

### Continuous Integration

**GitHub Actions Workflow:**
1. Run unit tests
2. Run property-based tests
3. Build frontend
4. Build backend
5. Package for all platforms
6. Upload artifacts
7. Create GitHub release (on tag)

### Distribution

**Release Channels:**
- Stable: Tagged releases
- Beta: Pre-release tags
- Development: Nightly builds from main branch

**Auto-Update Server:**
- Host release metadata JSON
- Serve update packages
- Track download statistics

## Security Considerations

### API Key Storage

- Use electron-store with encryption
- Never log API keys
- Clear from memory after use
- Provide option to clear stored keys

### Code Signing

- Sign all executables to avoid security warnings
- Use proper certificates for each platform
- Implement certificate pinning for updates

### Update Security

- Verify update signatures before installation
- Use HTTPS for all update downloads
- Implement checksum verification
- Rollback on failed updates

### Sandboxing

- Run backend process with minimal permissions
- Restrict file system access to app data directory
- Use Electron's context isolation
- Disable Node.js integration in renderer where possible

## Deployment Strategy

### Phase 1: Alpha Release
- Internal testing only
- Windows build only
- Manual installation
- Feedback collection

### Phase 2: Beta Release
- Public beta program
- All platforms
- Auto-updates enabled
- Bug tracking and fixes

### Phase 3: Stable Release
- Public release
- Full documentation
- Marketing and promotion
- Support channels established

### Phase 4: Maintenance
- Regular updates
- Security patches
- Feature additions
- Community feedback integration
