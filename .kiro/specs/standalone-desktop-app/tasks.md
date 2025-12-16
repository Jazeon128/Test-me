# Implementation Plan

- [x] 1. Set up Electron project structure





  - Create electron/ directory with main, preload, and renderer subdirectories
  - Initialize package.json with Electron dependencies
  - Configure electron-builder for packaging
  - Set up development scripts for running Electron in dev mode
  - _Requirements: 1.1, 1.2_

- [x] 2. Implement Backend Process Manager




  - [x] 2.1 Create BackendManager class


    - Write process spawning logic to launch bundled Python executable
    - Implement port allocation (try ports 8000-8010)
    - Add environment variable configuration for backend
    - _Requirements: 1.2_

  - [x] 2.2 Implement backend health checking

    - Add HTTP health check endpoint polling
    - Implement retry logic with exponential backoff
    - Add timeout handling
    - _Requirements: 1.2, 6.1_

  - [x] 2.3 Write property test for backend lifecycle


    - **Property 1: Backend startup invariant**
    - **Validates: Requirements 1.2**

  - [x] 2.4 Add backend process monitoring and restart


    - Detect backend crashes
    - Implement automatic restart with backoff
    - Add crash logging
    - _Requirements: 6.1_

  - [x] 2.5 Write unit tests for BackendManager


    - Test process spawning
    - Test health check logic
    - Test restart behavior
    - _Requirements: 1.2, 6.1_

- [x] 3. Implement Electron Main Process




  - [x] 3.1 Create main window management


    - Initialize BrowserWindow with proper configuration
    - Load renderer HTML
    - Handle window lifecycle events
    - _Requirements: 2.1_

  - [x] 3.2 Write property test for window controls


    - **Property 7: Window controls presence**
    - **Validates: Requirements 2.1**

  - [x] 3.3 Implement system tray functionality

    - Create tray icon and menu
    - Handle tray click events
    - Implement window show/hide on tray interaction
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 3.4 Write property test for tray behavior


    - **Property 5: Window close to tray**
    - **Property 6: Tray icon restore**
    - **Validates: Requirements 2.2, 2.3**

  - [x] 3.5 Set up application lifecycle handlers

    - Handle app ready event
    - Handle window-all-closed event
    - Handle before-quit event
    - Ensure graceful backend shutdown
    - _Requirements: 1.2_

  - [x] 3.6 Write unit tests for main process


    - Test window creation
    - Test tray menu creation
    - Test lifecycle handlers
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Implement Settings Manager




  - [x] 4.1 Create SettingsManager class


    - Implement get/set methods for settings
    - Add secure storage for API keys using encryption
    - Set up settings file location in app data directory
    - Implement default settings
    - _Requirements: 3.5, 4.3_

  - [x] 4.2 Add API key validation


    - Implement format validation for OpenAI keys
    - Implement format validation for Anthropic keys
    - Implement format validation for Google keys
    - _Requirements: 4.2_

  - [x] 4.3 Write property test for API key validation


    - **Property 11: API key validation**
    - **Validates: Requirements 4.2**

  - [x] 4.4 Write property test for secure storage


    - **Property 12: API key secure storage**
    - **Validates: Requirements 4.3**

  - [x] 4.5 Write property test for settings persistence


    - **Property 4: Settings persistence round-trip**
    - **Validates: Requirements 3.5**

  - [x] 4.6 Write unit tests for SettingsManager


    - Test get/set operations
    - Test encryption/decryption
    - Test validation logic
    - _Requirements: 3.5, 4.2, 4.3_


- [x] 5. Implement IPC Communication





  - [x] 5.1 Create IPC handlers in main process

    - Handle open-file-dialog requests
    - Handle open-settings requests
    - Handle get-logs requests
    - Handle get-app-info requests
    - Handle quit-app requests
    - _Requirements: 9.1, 9.2_


  - [x] 5.2 Create preload script for secure IPC

    - Expose IPC methods to renderer via contextBridge
    - Implement type-safe IPC API
    - _Requirements: 1.2_


  - [x] 5.3 Write unit tests for IPC handlers

    - Test each IPC channel
    - Test error handling
    - Test response formats
    - _Requirements: 9.1, 9.2_


- [x] 6. Implement Data Directory Management




  - [x] 6.1 Create data directory initialization


    - Determine OS-specific app data location
    - Create directory structure on first run
    - Set up database path
    - Set up uploads directory path
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.2 Write property test for data directory creation


    - **Property 10: Data directory creation**
    - **Validates: Requirements 3.1**

  - [x] 6.3 Write property test for database location


    - **Property 2: Database initialization**
    - **Property 9: Database location**
    - **Validates: Requirements 1.3, 3.2**

  - [x] 6.4 Write property test for file storage


    - **Property 8: File upload location**
    - **Validates: Requirements 3.3**

  - [x] 6.5 Write property test for data persistence


    - **Property 3: Data persistence round-trip**
    - **Validates: Requirements 3.4**

- [x] 7. Update Frontend for Electron





  - [x] 7.1 Create SettingsDialog component


    - Build form for API key configuration
    - Add provider selection (OpenAI, Anthropic, Google)
    - Implement save/cancel actions
    - Add validation feedback
    - _Requirements: 4.1_

  - [x] 7.2 Write property test for settings dialog


    - **Property 14: Settings dialog availability**
    - **Validates: Requirements 4.1**

  - [x] 7.3 Create LogViewer component


    - Build scrollable log display
    - Add log filtering options
    - Implement export functionality
    - _Requirements: 9.2, 9.4_

  - [x] 7.4 Write property test for log viewer


    - **Property 25: Log viewer availability**
    - **Property 27: Log export**
    - **Validates: Requirements 9.1, 9.2, 9.4**

  - [x] 7.5 Create AboutDialog component


    - Display application version
    - Display system information
    - Add links to documentation and support
    - _Requirements: 9.3_

  - [x] 7.6 Update API client for dynamic backend URL


    - Read backend port from Electron IPC
    - Update axios base URL configuration
    - _Requirements: 1.2_

  - [x] 7.7 Add first-run welcome screen


    - Create welcome component
    - Prompt for API key configuration
    - Show getting started guide
    - _Requirements: 4.4_

  - [x] 7.8 Write property test for missing API key handling


    - **Property 13: Missing API key handling**
    - **Validates: Requirements 4.5**

  - [x] 7.9 Write unit tests for new components



    - Test SettingsDialog rendering and validation
    - Test LogViewer rendering
    - Test AboutDialog information display
    - _Requirements: 4.1, 9.2, 9.3_

- [x] 8. Implement Error Handling





  - [x] 8.1 Add backend failure error dialogs


    - Create error dialog component
    - Add troubleshooting steps
    - Implement retry functionality
    - _Requirements: 6.1_

  - [x] 8.2 Write property test for backend failure handling


    - **Property 15: Backend failure handling**
    - **Validates: Requirements 6.1**

  - [x] 8.3 Add API error handling


    - Intercept API errors in axios
    - Display user-friendly error messages
    - Add suggested actions for common errors
    - _Requirements: 6.3_

  - [x] 8.4 Write property test for API error messaging


    - **Property 16: API error messaging**
    - **Validates: Requirements 6.3**

  - [x] 8.5 Implement error logging


    - Set up log file in app data directory
    - Log all errors with stack traces
    - Add log rotation
    - _Requirements: 6.4, 9.5_

  - [x] 8.6 Write property test for error logging


    - **Property 17: Error logging**
    - **Property 28: Error detail logging**
    - **Validates: Requirements 6.4, 9.5**

  - [x] 8.7 Add crash recovery


    - Implement crash detection on startup
    - Save user data before crash
    - Display crash report dialog
    - _Requirements: 6.5_

  - [x] 8.8 Write unit tests for error handling


    - Test error dialog display
    - Test error logging
    - Test crash recovery
    - _Requirements: 6.1, 6.3, 6.4, 6.5_


- [x] 9. Implement Keyboard Shortcuts



  - [x] 9.1 Register global keyboard shortcuts


    - Register Ctrl+N / Cmd+N for new flashcard
    - Register Ctrl+O / Cmd+O for file upload
    - Register Ctrl+, / Cmd+, for settings
    - Register F11 for fullscreen toggle
    - Register Ctrl+Q / Cmd+Q for quit
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 9.2 Write property test for keyboard shortcuts


    - **Property 21: Shortcut consistency**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

  - [x] 9.3 Write unit tests for shortcuts


    - Test each shortcut registration
    - Test shortcut actions
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_


- [x] 10. Implement Auto-Updater



  - [x] 10.1 Set up electron-updater


    - Configure update server URL
    - Implement update check on startup
    - Add update event handlers
    - _Requirements: 5.1_

  - [x] 10.2 Write property test for update check


    - **Property 22: Update check on startup**
    - **Validates: Requirements 5.1**

  - [x] 10.3 Create update notification UI


    - Display update available notification
    - Add accept/decline buttons
    - Show download progress
    - _Requirements: 5.2_

  - [x] 10.4 Write property test for update notification


    - **Property 23: Update notification**
    - **Validates: Requirements 5.2**

  - [x] 10.5 Implement update installation


    - Download update in background
    - Verify checksum
    - Install and prompt for restart
    - _Requirements: 5.3, 5.4_

  - [x] 10.6 Add update reminder logic


    - Track declined updates
    - Show reminder on next startup
    - _Requirements: 5.5_

  - [x] 10.7 Write property test for update reminder


    - **Property 24: Update reminder**
    - **Validates: Requirements 5.5**

  - [x] 10.8 Write unit tests for auto-updater


    - Test update check logic
    - Test notification display
    - Test reminder logic
    - _Requirements: 5.1, 5.2, 5.5_


- [x] 11. Implement Logging and Diagnostics




  - [x] 11.1 Set up structured logging


    - Configure log levels
    - Set up log file rotation
    - Add timestamp and context to logs
    - _Requirements: 6.4, 9.5_

  - [x] 11.2 Create diagnostic report generator


    - Collect application version
    - Collect OS information
    - Collect configuration (sanitized)
    - Generate formatted report
    - _Requirements: 9.3_

  - [x] 11.3 Write property test for diagnostic report


    - **Property 26: Diagnostic report completeness**
    - **Validates: Requirements 9.3**

  - [x] 11.4 Write unit tests for logging


    - Test log file creation
    - Test log rotation
    - Test diagnostic report generation
    - _Requirements: 6.4, 9.3, 9.5_


- [x] 12. Bundle Python Backend with PyInstaller



  - [x] 12.1 Create PyInstaller spec file


    - Configure entry point (main.py)
    - Include all app modules
    - Add hidden imports for FastAPI and dependencies
    - Exclude test and dev dependencies
    - _Requirements: 1.4_

  - [x] 12.2 Test backend bundle


    - Build standalone executable
    - Test on clean system without Python
    - Verify all dependencies included
    - Test database initialization
    - _Requirements: 1.4_

  - [x] 12.3 Optimize bundle size


    - Remove unnecessary files
    - Compress assets
    - Use UPX compression if beneficial
    - _Requirements: 1.4_

- [ ] 13. Configure electron-builder for Packaging
  - [ ] 13.1 Set up Windows build configuration
    - Configure NSIS installer
    - Set up portable executable
    - Add application icon
    - Configure code signing
    - _Requirements: 7.1, 7.5_

  - [ ] 13.2 Set up macOS build configuration
    - Configure DMG creation
    - Set up .app bundle
    - Add application icon
    - Configure code signing and notarization
    - _Requirements: 7.2, 7.5_

  - [ ] 13.3 Set up Linux build configuration
    - Configure AppImage creation
    - Configure .deb package
    - Configure .rpm package
    - Add application icon
    - _Requirements: 7.3_

  - [ ] 13.4 Test packaging on all platforms
    - Build for Windows and verify installer
    - Build for macOS and verify DMG
    - Build for Linux and verify packages
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 14. Implement Performance Optimizations





  - [x] 14.1 Add splash screen


    - Create splash screen HTML
    - Display within 1 second of launch
    - Show loading progress
    - Hide when backend ready
    - _Requirements: 8.1, 8.4, 8.5_

  - [x] 14.2 Write property test for splash screen timing


    - **Property 18: Splash screen timing**
    - **Validates: Requirements 8.1**

  - [x] 14.3 Optimize backend startup


    - Lazy load heavy dependencies
    - Optimize database initialization
    - Target 3 second startup time
    - _Requirements: 8.2_

  - [x] 14.4 Write property test for startup timing


    - **Property 19: Main window timing**
    - **Validates: Requirements 8.2**

  - [x] 14.5 Optimize window restoration


    - Cache window state
    - Minimize restoration operations
    - Target 500ms restoration time
    - _Requirements: 8.3_

  - [x] 14.6 Write property test for restoration timing


    - **Property 20: Window restoration timing**
    - **Validates: Requirements 8.3**

- [x] 15. Set up CI/CD Pipeline





  - [x] 15.1 Create GitHub Actions workflow


    - Set up matrix build for all platforms
    - Run unit tests
    - Run property-based tests
    - Build and package application
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 15.2 Configure artifact uploads


    - Upload Windows installer
    - Upload macOS DMG
    - Upload Linux packages
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 15.3 Set up release automation


    - Create GitHub release on tag
    - Upload all platform packages
    - Generate release notes
    - _Requirements: 5.1_


- [x] 16. Create Documentation





  - [x] 16.1 Write user documentation

    - Installation guide for each platform
    - Getting started guide
    - API key configuration guide
    - Troubleshooting guide
    - _Requirements: 4.1, 6.1_

  - [x] 16.2 Write developer documentation


    - Build instructions
    - Architecture overview
    - Contributing guide
    - Testing guide
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 17. Final Testing and Polish





  - [x] 17.1 Perform end-to-end testing


    - Test complete user workflows
    - Test on all target platforms
    - Test with different screen configurations
    - _Requirements: All_

  - [x] 17.2 Performance testing


    - Measure startup time
    - Measure memory usage
    - Measure CPU usage during AI generation
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 17.3 Security review


    - Verify API key encryption
    - Verify code signing
    - Verify update security
    - _Requirements: 4.3, 7.5_

  - [x] 17.4 Checkpoint - Ensure all tests pass


    - Ensure all tests pass, ask the user if questions arise.
