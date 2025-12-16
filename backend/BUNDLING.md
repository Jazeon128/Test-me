# Backend Bundling Guide

This guide explains how to bundle the FlashLearn backend into a standalone executable using PyInstaller.

## Overview

The backend is bundled using PyInstaller, which packages the Python interpreter, all dependencies, and the application code into a single distributable directory. This allows the backend to run on systems without Python installed.

## Prerequisites

1. **Python 3.9+** installed
2. **All dependencies** installed: `pip install -r requirements.txt`
3. **PyInstaller** installed: `pip install pyinstaller`

## Quick Start

### Option 1: Using the Build Script (Recommended)

```bash
cd backend
python build_backend.py
```

The script will:
- Check for PyInstaller
- Clean previous builds
- Build the executable
- Verify the output
- Provide testing instructions

### Option 2: Manual Build

```bash
cd backend
pyinstaller backend.spec --clean
```

## Build Output

After building, you'll find:

```
backend/
├── build/              # Temporary build files (can be deleted)
├── dist/
│   └── backend/        # Standalone backend bundle
│       ├── backend.exe # Main executable (Windows)
│       ├── backend     # Main executable (macOS/Linux)
│       └── ...         # Dependencies and libraries
```

## Testing the Bundle

### 1. Basic Test

Navigate to the bundle directory and run:

```bash
cd dist/backend
./backend  # macOS/Linux
backend.exe  # Windows
```

The server should start on `http://localhost:8000`

### 2. Health Check

In another terminal:

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "ai_provider": "anthropic",
  "ai_configured": false
}
```

### 3. Test with API Keys

Set environment variables before running:

```bash
# Linux/macOS
export ANTHROPIC_API_KEY="your-key-here"
./backend

# Windows
set ANTHROPIC_API_KEY=your-key-here
backend.exe
```

### 4. Test Database Initialization

The backend should automatically create a SQLite database in the current directory. Check for `test_me.db` after startup.

### 5. Test Document Upload

```bash
curl -X POST http://localhost:8000/api/documents \
  -F "file=@test.pdf" \
  -F "title=Test Document"
```

## Configuration

### Environment Variables

The bundled backend respects these environment variables:

- `ANTHROPIC_API_KEY` - Anthropic API key
- `OPENAI_API_KEY` - OpenAI API key
- `GEMINI_API_KEY` - Google Gemini API key
- `AI_PROVIDER` - AI provider to use (anthropic/openai/gemini)
- `DATABASE_URL` - SQLite database path (default: ./test_me.db)
- `UPLOAD_DIR` - Upload directory (default: ./uploads)
- `LOG_LEVEL` - Logging level (default: INFO)

### Runtime Configuration

The backend can be configured at runtime by:

1. Setting environment variables before launch
2. Creating a `.env` file in the same directory as the executable
3. Using the `/api/settings` endpoint after startup

## Electron Integration

To integrate with Electron:

1. Build the backend bundle
2. Copy the entire `dist/backend/` directory to `electron/resources/backend/`
3. Update Electron's backend manager to spawn the executable
4. Pass environment variables from Electron settings

Example Electron integration:

```javascript
const backendPath = path.join(
  process.resourcesPath,
  'backend',
  process.platform === 'win32' ? 'backend.exe' : 'backend'
);

const backendProcess = spawn(backendPath, [], {
  env: {
    ...process.env,
    ANTHROPIC_API_KEY: settings.get('anthropicApiKey'),
    DATABASE_URL: path.join(app.getPath('userData'), 'test_me.db'),
    UPLOAD_DIR: path.join(app.getPath('userData'), 'uploads'),
  }
});
```

## Troubleshooting

### Build Fails with Import Errors

If PyInstaller can't find certain modules, add them to `hiddenimports` in `backend.spec`:

```python
hiddenimports = [
    'your.missing.module',
    # ... other imports
]
```

### Executable is Too Large

The bundle size can be reduced by:

1. Removing unnecessary dependencies from `requirements.txt`
2. Adding more exclusions to `backend.spec`
3. Using UPX compression (already enabled)
4. Excluding test and development dependencies (already done)

Current typical sizes:
- Windows: ~150-200 MB
- macOS: ~120-150 MB
- Linux: ~120-150 MB

### Runtime Errors

If the executable fails at runtime:

1. Run with `--debug` flag to see detailed logs
2. Check that all data files are included in `backend.spec`
3. Verify environment variables are set correctly
4. Check file permissions on the executable

### Database Errors

If database initialization fails:

1. Ensure write permissions in the working directory
2. Check that SQLite is properly bundled
3. Verify the `DATABASE_URL` environment variable

### Missing Dependencies

If you get "module not found" errors at runtime:

1. Add the module to `hiddenimports` in `backend.spec`
2. If it's a data file, add it to `datas` in `backend.spec`
3. Rebuild with `pyinstaller backend.spec --clean`

## Platform-Specific Notes

### Windows

- The executable is named `backend.exe`
- Console window will appear (required for logging)
- May trigger Windows Defender on first run (normal for unsigned executables)
- Consider code signing for production releases

### macOS

- The executable is named `backend`
- May need to grant permissions: `chmod +x backend`
- Gatekeeper may block unsigned executables
- Consider code signing and notarization for production releases

### Linux

- The executable is named `backend`
- May need to grant permissions: `chmod +x backend`
- Tested on Ubuntu 20.04+, should work on most distributions
- May need to install system libraries on minimal systems

## Optimization Tips

### Reducing Bundle Size

1. **Remove unused parsers**: If you don't need certain document types, remove their dependencies
2. **Exclude AI providers**: If you only use one AI provider, exclude the others
3. **Use virtual environment**: Build in a clean venv with only required packages
4. **Profile imports**: Use `pyinstaller --log-level=DEBUG` to see what's being included

### Improving Startup Time

1. **Lazy imports**: Import heavy modules only when needed
2. **Optimize database**: Use WAL mode for SQLite
3. **Precompile**: PyInstaller already compiles Python to bytecode
4. **Reduce logging**: Set `LOG_LEVEL=WARNING` for production

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Build Backend

on: [push]

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pyinstaller
      
      - name: Build backend
        run: |
          cd backend
          pyinstaller backend.spec --clean
      
      - name: Upload artifact
        uses: actions/upload-artifact@v2
        with:
          name: backend-${{ matrix.os }}
          path: backend/dist/backend/
```

## Additional Resources

- [PyInstaller Documentation](https://pyinstaller.org/en/stable/)
- [FastAPI Deployment Guide](https://fastapi.tiangolo.com/deployment/)
- [Electron Process Management](https://www.electronjs.org/docs/latest/api/child-process)

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review PyInstaller logs in `build/backend/warn-backend.txt`
3. Test in a clean environment without Python installed
4. Open an issue with build logs and error messages
