# FlashLearn Desktop - Developer Guide

This guide provides comprehensive information for developers who want to build, modify, or contribute to FlashLearn Desktop.

## Table of Contents

- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Build Instructions](#build-instructions)
- [Testing Guide](#testing-guide)
- [Contributing Guidelines](#contributing-guidelines)
- [Release Process](#release-process)
- [Troubleshooting Development Issues](#troubleshooting-development-issues)

---

## Development Setup

### Prerequisites

**Required Software:**
- Node.js 18+ and npm
- Python 3.9+
- Git

**Platform-Specific Requirements:**

**Windows:**
- Visual Studio Build Tools or Visual Studio 2019+
- Windows SDK
- Code signing certificate (for releases)

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`
- Apple Developer account (for code signing)

**Linux:**
- Build essentials: `sudo apt install build-essential`
- FUSE: `sudo apt install fuse libfuse2`

### Clone the Repository

```bash
git clone https://github.com/yourusername/flashlearn.git
cd flashlearn
```

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Initialize database
python -c "from app.db.database import init_db; init_db()"

# Run backend (for development)
python main.py
```

Backend will be available at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env if needed

# Run frontend (for development)
npm run dev
```

Frontend will be available at `http://localhost:5173`

### Electron Setup

```bash
cd electron

# Install dependencies
npm install

# Run Electron in development mode
npm run dev
```

This will:
1. Start the backend server
2. Build the frontend
3. Launch Electron with hot-reload

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Electron Main Process                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │  - Window Management (index.js)                     │ │
│  │  - System Tray (index.js)                           │ │
│  │  - Backend Process Manager (backend-manager.js)     │ │
│  │  - IPC Handler (ipc-handlers.js)                    │ │
│  │  - Settings Manager (settings-manager.js)           │ │
│  │  - Auto-updater (auto-updater.js)                   │ │
│  │  - Logger (logger.js)                               │ │
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
│  - React Components  │          │    PyInstaller       │
│  - API Client        │          │  - SQLite Database   │
└──────────────────────┘          └──────────────────────┘
```

### Directory Structure

```
flashlearn/
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── db/             # Database models and connection
│   │   ├── models/         # SQLAlchemy models
│   │   ├── services/       # Business logic
│   │   │   ├── ai/         # AI integration
│   │   │   └── parsers/    # Document parsers
│   │   ├── utils/          # Utility functions
│   │   └── middleware/     # FastAPI middleware
│   ├── tests/              # Backend tests
│   │   ├── unit/
│   │   ├── integration/
│   │   ├── property/       # Property-based tests
│   │   └── benchmarks/
│   ├── main.py             # FastAPI entry point
│   ├── backend.spec        # PyInstaller spec
│   └── requirements.txt
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API client
│   │   ├── context/        # React context
│   │   └── main.jsx        # Entry point
│   ├── public/             # Static assets
│   └── package.json
│
├── electron/               # Electron main process
│   ├── main/               # Main process code
│   │   ├── index.js        # Main entry point
│   │   ├── backend-manager.js
│   │   ├── ipc-handlers.js
│   │   ├── settings-manager.js
│   │   ├── auto-updater.js
│   │   ├── logger.js
│   │   ├── data-directory-manager.js
│   │   ├── keyboard-shortcuts.js
│   │   ├── window-state-manager.js
│   │   ├── splash-window.js
│   │   ├── diagnostic-report.js
│   │   ├── api-key-validator.js
│   │   └── __tests__/      # Electron tests
│   ├── preload/            # Preload scripts
│   │   ├── index.js
│   │   └── splash-preload.js
│   ├── renderer/           # Renderer assets
│   │   └── splash.html
│   ├── dev-runner.js       # Development runner
│   └── package.json
│
├── docs/                   # Documentation
│   ├── USER_GUIDE.md
│   ├── DEVELOPER_GUIDE.md
│   └── adr/                # Architecture Decision Records
│
├── .github/
│   └── workflows/          # CI/CD workflows
│       ├── desktop-app-build.yml
│       ├── code-quality.yml
│       └── performance-benchmarks.yml
│
└── README.md
```

### Key Components

#### Electron Main Process (`electron/main/`)

**index.js** - Main entry point
- Creates application windows
- Manages system tray
- Handles application lifecycle
- Coordinates other modules

**backend-manager.js** - Backend Process Manager
- Spawns Python backend executable
- Monitors backend health
- Handles backend crashes and restarts
- Manages port allocation

**ipc-handlers.js** - IPC Communication
- Handles messages from renderer
- Provides native dialogs
- Exposes system information

**settings-manager.js** - Settings Management
- Stores user preferences
- Encrypts sensitive data (API keys)
- Provides settings validation

**auto-updater.js** - Automatic Updates
- Checks for updates on startup
- Downloads and installs updates
- Manages update notifications

**logger.js** - Logging System
- Structured logging with levels
- Log file rotation
- Error tracking

#### Backend (`backend/`)

**FastAPI Application**
- RESTful API for frontend
- Document processing
- AI integration
- Database operations
- Spaced repetition algorithm

**Key Services:**
- `question_generator.py` - AI-powered flashcard generation
- `parsers/` - Document parsing (PDF, DOCX, etc.)
- `sm2_algorithm.py` - Spaced repetition implementation

#### Frontend (`frontend/`)

**React Application**
- Modern React with hooks
- Vite for fast development
- Tailwind CSS for styling
- Axios for API calls

**Key Components:**
- `SettingsDialog.jsx` - API key configuration
- `LogViewer.jsx` - Application logs
- `AboutDialog.jsx` - Version information
- `UpdateNotification.jsx` - Update prompts

---

## Build Instructions

### Development Build

**Run Full Stack in Development:**

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python main.py

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Electron
cd electron
npm run dev
```

**Or use the integrated dev runner:**

```bash
cd electron
npm run dev
```

This starts all three components with hot-reload enabled.

### Production Build

#### 1. Build Backend Executable

```bash
cd backend

# Activate virtual environment
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Build with PyInstaller
python build_backend.py

# Output: backend/dist/backend-server or backend-server.exe
```

**Verify backend bundle:**
```bash
cd backend
python test_bundle.py
```

#### 2. Build Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Output: frontend/dist/
```

#### 3. Package Electron Application

```bash
cd electron

# Install dependencies
npm install

# Copy backend executable
# Windows:
copy ..\backend\dist\backend-server.exe .\backend\
# macOS/Linux:
cp ../backend/dist/backend-server ./backend/

# Copy frontend build
# Windows:
xcopy /E /I ..\frontend\dist .\renderer
# macOS/Linux:
cp -r ../frontend/dist/* ./renderer/

# Build for current platform
npm run build

# Build for all platforms (requires platform-specific setup)
npm run build:all
```

**Platform-Specific Builds:**

```bash
# Windows only
npm run build:win

# macOS only
npm run build:mac

# Linux only
npm run build:linux
```

**Output locations:**
- Windows: `electron/dist/FlashLearn-Setup-x.x.x.exe`
- macOS: `electron/dist/FlashLearn-x.x.x.dmg`
- Linux: `electron/dist/FlashLearn-x.x.x.AppImage`

### Build Configuration

**electron-builder Configuration** (`electron/package.json`):

```json
{
  "build": {
    "appId": "com.flashlearn.app",
    "productName": "FlashLearn",
    "directories": {
      "output": "dist",
      "buildResources": "build"
    },
    "files": [
      "main/**/*",
      "preload/**/*",
      "renderer/**/*",
      "backend/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "backend",
        "to": "backend",
        "filter": ["**/*"]
      }
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "build/icon.ico"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "build/icon.icns",
      "category": "public.app-category.education"
    },
    "linux": {
      "target": ["AppImage", "deb", "rpm"],
      "icon": "build/icon.png",
      "category": "Education"
    }
  }
}
```

### Code Signing

**Windows:**
```bash
# Set environment variables
set CSC_LINK=path\to\certificate.pfx
set CSC_KEY_PASSWORD=your_password

# Build with signing
npm run build:win
```

**macOS:**
```bash
# Set environment variables
export CSC_LINK=path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app-specific-password

# Build with signing and notarization
npm run build:mac
```

---

## Testing Guide

### Backend Testing

**Run All Tests:**
```bash
cd backend
pytest
```

**Run Specific Test Types:**
```bash
# Unit tests only
pytest tests/unit/

# Integration tests
pytest tests/integration/

# Property-based tests
pytest tests/property/

# With coverage
pytest --cov=app --cov-report=html
```

**Property-Based Testing:**

We use Hypothesis for property-based testing. Each test runs 100+ iterations with random inputs.

Example:
```python
from hypothesis import given, strategies as st

@given(st.text(min_size=1))
def test_document_parsing_preserves_length(content):
    """Property: Parsing should not lose content"""
    parsed = parse_document(content)
    assert len(parsed) >= len(content) * 0.9  # Allow some formatting
```

**Run with more iterations:**
```bash
pytest tests/property/ --hypothesis-profile=ci
```

### Frontend Testing

**Run All Tests:**
```bash
cd frontend
npm test
```

**Run with Coverage:**
```bash
npm run test:coverage
```

**Run Specific Tests:**
```bash
# Component tests
npm test -- SettingsDialog

# Property tests
npm test -- property.test
```

**Property-Based Testing:**

We use fast-check for JavaScript property-based testing.

Example:
```javascript
import fc from 'fast-check';

test('API key validation rejects invalid formats', () => {
  fc.assert(
    fc.property(
      fc.string().filter(s => !s.startsWith('sk-')),
      (invalidKey) => {
        expect(validateApiKey(invalidKey)).toBe(false);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Electron Testing

**Run All Tests:**
```bash
cd electron
npm test
```

**Run Specific Test Suites:**
```bash
# Main process tests
npm test -- main

# Property tests
npm test -- property.test

# With coverage
npm run test:coverage
```

**Property-Based Testing:**

Example:
```javascript
const fc = require('fast-check');

test('Property: Backend startup invariant', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        port: fc.integer({ min: 8000, max: 8010 }),
        timeout: fc.integer({ min: 1000, max: 5000 })
      }),
      async (config) => {
        const manager = new BackendManager();
        const started = await manager.start(config);
        expect(started).toBe(true);
        expect(manager.isRunning()).toBe(true);
        await manager.stop();
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

**End-to-End Tests:**

We use Playwright for E2E testing:

```bash
cd electron
npm run test:e2e
```

**Manual Testing Checklist:**

Before release, manually test:
- [ ] Application startup on clean system
- [ ] First-run experience
- [ ] API key configuration
- [ ] Document upload and processing
- [ ] Flashcard generation
- [ ] Study session
- [ ] Settings persistence
- [ ] System tray functionality
- [ ] Window management
- [ ] Keyboard shortcuts
- [ ] Auto-update flow
- [ ] Error handling
- [ ] Log viewer
- [ ] Diagnostic report

### Performance Testing

**Backend Benchmarks:**
```bash
cd backend
pytest tests/benchmarks/ --benchmark-only
```

**Frontend Performance:**
```bash
cd frontend
npm run build
npm run preview
# Use Chrome DevTools for performance profiling
```

**Electron Performance:**
- Monitor startup time
- Check memory usage
- Profile CPU usage during AI generation

### Test Coverage Goals

- Backend: >80% code coverage
- Frontend: >70% code coverage
- Electron: >60% code coverage
- All critical paths: 100% coverage

---

## Contributing Guidelines

### Getting Started

1. **Fork the Repository**
   - Click "Fork" on GitHub
   - Clone your fork locally

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Write code
   - Add tests
   - Update documentation

4. **Test Your Changes**
   ```bash
   # Run all tests
   cd backend && pytest
   cd frontend && npm test
   cd electron && npm test
   ```

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

6. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   - Open Pull Request on GitHub
   - Fill out PR template
   - Wait for review

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(backend): add support for PowerPoint files

fix(electron): resolve backend startup race condition

docs(user-guide): update API key configuration steps

test(frontend): add property tests for settings dialog
```

### Code Style

**Python (Backend):**
- Follow PEP 8
- Use Black for formatting: `black .`
- Use flake8 for linting: `flake8 .`
- Use mypy for type checking: `mypy app/`

**JavaScript/React (Frontend/Electron):**
- Follow Airbnb style guide
- Use Prettier for formatting: `npm run format`
- Use ESLint for linting: `npm run lint`

**Pre-commit Hooks:**

We use pre-commit hooks to enforce code quality:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

### Pull Request Guidelines

**Before Submitting:**
- [ ] All tests pass
- [ ] Code is formatted
- [ ] No linting errors
- [ ] Documentation updated
- [ ] CHANGELOG.md updated (for significant changes)
- [ ] Property-based tests added for new features

**PR Description Should Include:**
- What changes were made
- Why the changes were necessary
- How to test the changes
- Screenshots (for UI changes)
- Related issues (if any)

**Review Process:**
1. Automated checks run (CI/CD)
2. Code review by maintainer
3. Address feedback
4. Approval and merge

### Issue Guidelines

**Bug Reports Should Include:**
- FlashLearn version
- Operating system and version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots or logs
- Diagnostic report (if applicable)

**Feature Requests Should Include:**
- Clear description of the feature
- Use case / motivation
- Proposed implementation (optional)
- Alternatives considered

### Development Workflow

**Feature Development:**
1. Create issue describing the feature
2. Discuss approach in issue comments
3. Create branch from `main`
4. Implement feature with tests
5. Submit PR referencing issue
6. Address review feedback
7. Merge when approved

**Bug Fixes:**
1. Create issue describing the bug
2. Create branch from `main`
3. Write failing test that reproduces bug
4. Fix the bug
5. Verify test passes
6. Submit PR referencing issue
7. Merge when approved

### Documentation

**When to Update Documentation:**
- Adding new features
- Changing existing behavior
- Fixing bugs that affect user experience
- Adding new configuration options
- Changing build process

**Documentation Locations:**
- User-facing: `docs/USER_GUIDE.md`
- Developer-facing: `docs/DEVELOPER_GUIDE.md`
- API documentation: Inline docstrings
- Architecture decisions: `docs/adr/`

---

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

Example: `1.2.3`
- 1 = Major version
- 2 = Minor version
- 3 = Patch version

### Release Checklist

**Pre-Release:**
- [ ] All tests passing on CI
- [ ] Version bumped in all package.json files
- [ ] CHANGELOG.md updated
- [ ] Documentation updated
- [ ] Manual testing completed
- [ ] Performance benchmarks run
- [ ] Security review completed

**Release Steps:**

1. **Update Version Numbers**
   ```bash
   # Update version in:
   # - electron/package.json
   # - frontend/package.json
   # - backend/pyproject.toml
   ```

2. **Update CHANGELOG.md**
   ```markdown
   ## [1.2.3] - 2024-12-05
   
   ### Added
   - New feature X
   
   ### Fixed
   - Bug Y
   
   ### Changed
   - Improvement Z
   ```

3. **Create Git Tag**
   ```bash
   git add .
   git commit -m "chore: release v1.2.3"
   git tag -a v1.2.3 -m "Release v1.2.3"
   git push origin main --tags
   ```

4. **GitHub Actions Builds**
   - CI automatically builds for all platforms
   - Artifacts uploaded to GitHub release
   - Release notes generated from CHANGELOG

5. **Verify Release**
   - Download artifacts from GitHub
   - Test on each platform
   - Verify auto-update works

6. **Announce Release**
   - Update website
   - Post on social media
   - Notify users via email/Discord

### Hotfix Process

For critical bugs in production:

1. Create hotfix branch from release tag
   ```bash
   git checkout -b hotfix/v1.2.4 v1.2.3
   ```

2. Fix the bug and test

3. Update version to patch release

4. Merge to main and tag
   ```bash
   git checkout main
   git merge hotfix/v1.2.4
   git tag -a v1.2.4 -m "Hotfix v1.2.4"
   git push origin main --tags
   ```

### Beta Releases

For testing new features:

1. Create pre-release tag
   ```bash
   git tag -a v1.3.0-beta.1 -m "Beta release v1.3.0-beta.1"
   git push origin --tags
   ```

2. Mark as pre-release on GitHub

3. Announce to beta testers

4. Collect feedback

5. Fix issues and release beta.2, beta.3, etc.

6. Final release when stable

---

## Troubleshooting Development Issues

### Backend Issues

**Import Errors:**
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # or venv\Scripts\activate

# Reinstall dependencies
pip install -r requirements.txt
```

**Database Issues:**
```bash
# Reset database
rm test_me.db
python -c "from app.db.database import init_db; init_db()"
```

**PyInstaller Build Fails:**
```bash
# Clean build artifacts
rm -rf build/ dist/

# Rebuild
python build_backend.py

# Check for missing imports in backend.spec
```

### Frontend Issues

**Module Not Found:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Build Fails:**
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Rebuild
npm run build
```

**Hot Reload Not Working:**
- Check Vite config
- Restart dev server
- Clear browser cache

### Electron Issues

**Backend Not Starting:**
- Check backend executable exists in `electron/backend/`
- Verify executable permissions (macOS/Linux)
- Check logs in `electron/main/logger.js`

**Window Not Appearing:**
- Check for JavaScript errors in console
- Verify renderer files exist
- Check BrowserWindow configuration

**IPC Not Working:**
- Verify preload script is loaded
- Check contextBridge configuration
- Ensure IPC handlers are registered

**Build Fails:**
```bash
# Clean electron-builder cache
rm -rf dist/ node_modules/.cache

# Rebuild
npm run build
```

### Platform-Specific Issues

**Windows:**
- Ensure Visual Studio Build Tools installed
- Check Windows SDK version
- Verify code signing certificate

**macOS:**
- Ensure Xcode Command Line Tools installed
- Check Apple Developer certificate
- Verify notarization credentials

**Linux:**
- Install missing dependencies: `sudo apt install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libxcb-dri3-0`
- Check FUSE installation for AppImage

### Getting Help

**Resources:**
- GitHub Issues: Report bugs and ask questions
- GitHub Discussions: General discussions
- Discord: Real-time chat with community
- Stack Overflow: Tag questions with `flashlearn`

**When Asking for Help:**
1. Search existing issues first
2. Provide clear description
3. Include error messages and logs
4. Share minimal reproduction steps
5. Specify your environment (OS, versions, etc.)

---

## Additional Resources

### Documentation

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PyInstaller Documentation](https://pyinstaller.org/)
- [electron-builder Documentation](https://www.electron.build/)

### Testing

- [Hypothesis Documentation](https://hypothesis.readthedocs.io/)
- [fast-check Documentation](https://fast-check.dev/)
- [Jest Documentation](https://jestjs.io/)
- [Pytest Documentation](https://docs.pytest.org/)

### Tools

- [VS Code](https://code.visualstudio.com/) - Recommended IDE
- [GitHub Desktop](https://desktop.github.com/) - Git GUI
- [Postman](https://www.postman.com/) - API testing
- [React DevTools](https://react.dev/learn/react-developer-tools) - React debugging

---

## License

FlashLearn is licensed under the MIT License. See [LICENSE](../LICENSE) for details.

---

## Contact

- **GitHub**: [github.com/yourusername/flashlearn](https://github.com/yourusername/flashlearn)
- **Email**: support@flashlearn.com
- **Discord**: [discord.gg/flashlearn](https://discord.gg/flashlearn)
- **Twitter**: [@flashlearn](https://twitter.com/flashlearn)

---

**Last Updated:** December 2024
**Version:** 1.0.0
