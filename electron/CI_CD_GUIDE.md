# CI/CD Pipeline Guide

## Overview

The FlashLearn Desktop application uses GitHub Actions for continuous integration and deployment. The pipeline automatically builds, tests, and packages the application for Windows, macOS, and Linux.

## Workflow File

The main workflow is defined in `.github/workflows/desktop-app-build.yml`

## Pipeline Stages

### 1. Testing (Parallel)

Three test jobs run in parallel:

- **test-electron**: Runs Electron main process tests (unit + property-based)
- **test-frontend**: Runs React frontend tests
- **test-backend**: Runs Python backend tests (unit + property-based)

All tests must pass before proceeding to build stages.

### 2. Building (Parallel)

After tests pass, the pipeline builds components in parallel:

- **build-backend**: Creates standalone Python executables for Windows, macOS, and Linux using PyInstaller
- **build-frontend**: Builds the React frontend with Vite

Build artifacts are uploaded and cached for the packaging stage.

### 3. Packaging (Parallel)

Three packaging jobs run in parallel, each on their native platform:

- **package-windows**: Creates Windows installer (.exe) and portable executable
- **package-macos**: Creates macOS DMG for Intel and Apple Silicon
- **package-linux**: Creates AppImage, .deb, and .rpm packages

Each job:
1. Downloads the appropriate backend executable
2. Downloads the frontend build
3. Installs Electron dependencies
4. Runs electron-builder for the target platform
5. Uploads the packaged application as artifacts

### 4. Release (Conditional)

The **release** job only runs when a version tag is pushed (e.g., `v1.0.0`):

1. Downloads all platform packages
2. Generates release notes with download links
3. Creates a GitHub Release
4. Attaches all platform packages to the release

## Triggering Builds

### Automatic Triggers

The pipeline runs automatically on:

- **Push to main/develop**: Runs full build and test pipeline
- **Pull requests**: Runs full build and test pipeline
- **Version tags** (v*): Runs full pipeline + creates GitHub Release

### Manual Trigger

You can manually trigger a build from the GitHub Actions tab using the "Run workflow" button.

## Creating a Release

To create a new release:

1. Update version in `electron/package.json`
2. Update `CHANGELOG.md` with release notes
3. Commit changes: `git commit -am "Release v1.0.0"`
4. Create and push tag: 
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
5. The pipeline will automatically:
   - Build all platforms
   - Run all tests
   - Create GitHub Release
   - Upload all packages

## Artifacts

### Build Artifacts (7-day retention)

Intermediate build artifacts are kept for 7 days:
- `backend-windows`, `backend-macos`, `backend-linux`
- `frontend-build`

### Release Artifacts (30-day retention)

Final packaged applications are kept for 30 days:
- `windows-installer` - Windows NSIS installer
- `windows-portable` - Windows portable executable
- `macos-dmg` - macOS disk images
- `linux-appimage` - Linux AppImage
- `linux-deb` - Debian package
- `linux-rpm` - RPM package

## Platform-Specific Notes

### Windows

- Builds on `windows-latest` (Windows Server 2022)
- Creates NSIS installer with installation wizard
- Creates portable executable (no installation required)
- Artifacts: `FlashLearn-{version}-x64.exe`

### macOS

- Builds on `macos-latest` (macOS 12+)
- Creates DMG disk images for Intel (x64) and Apple Silicon (arm64)
- Requires code signing for distribution (not configured in CI)
- Artifacts: `FlashLearn-{version}-{arch}.dmg`

### Linux

- Builds on `ubuntu-latest` (Ubuntu 22.04)
- Creates three package formats:
  - **AppImage**: Universal, no installation required
  - **.deb**: For Debian/Ubuntu-based distributions
  - **.rpm**: For Red Hat/Fedora-based distributions
- Artifacts: `FlashLearn-{version}-x64.{AppImage|deb|rpm}`

## Environment Variables

The workflow uses these environment variables:

- `NODE_VERSION`: Node.js version (18)
- `PYTHON_VERSION`: Python version (3.9)
- `GH_TOKEN`: GitHub token for electron-builder (auto-provided)
- `GITHUB_TOKEN`: GitHub token for releases (auto-provided)

## Monitoring Builds

### GitHub Actions UI

1. Go to the "Actions" tab in your repository
2. Select "Desktop App Build & Package" workflow
3. View running or completed builds
4. Click on a build to see detailed logs

### Build Summary

Each build generates a summary showing:
- Test results for each component
- Build status for each platform
- Links to artifacts
- Release information (if applicable)

## Troubleshooting

### Build Failures

**Tests failing:**
- Check test logs in the respective test job
- Run tests locally: `npm test` (Electron/Frontend) or `pytest` (Backend)

**Backend build failing:**
- Check PyInstaller logs in `build-backend` job
- Verify `backend.spec` configuration
- Test locally: `python backend/build_backend.py`

**Packaging failing:**
- Check electron-builder logs in platform-specific job
- Verify `electron/package.json` build configuration
- Test locally: `npm run build:win|mac|linux`

**Release failing:**
- Verify tag format matches `v*` pattern
- Check GitHub token permissions
- Ensure all platform builds succeeded

### Common Issues

**Missing dependencies:**
- Update `requirements.txt` (Python)
- Update `package.json` (Node.js)
- Clear caches and retry

**Platform-specific errors:**
- Check platform-specific build logs
- Test on the target platform locally
- Review electron-builder documentation

**Artifact upload errors:**
- Verify file paths in workflow
- Check artifact size limits (GitHub has limits)
- Ensure files were created by build process

## Local Testing

Before pushing, test the build locally:

```bash
# Test Electron
cd electron
npm test

# Test Frontend
cd frontend
npm test -- --run

# Test Backend
cd backend
pytest

# Build Backend
cd backend
python build_backend.py

# Build Frontend
cd frontend
npm run build

# Package Electron (requires backend + frontend built)
cd electron
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
```

## Security Considerations

### Code Signing

The current workflow does NOT include code signing. For production releases:

**Windows:**
- Obtain Authenticode certificate
- Add certificate to GitHub Secrets
- Configure in electron-builder

**macOS:**
- Obtain Apple Developer certificate
- Configure notarization
- Add credentials to GitHub Secrets

**Linux:**
- Code signing is optional for Linux

### Secrets Management

Never commit sensitive data. Use GitHub Secrets for:
- Code signing certificates
- API keys (if needed for builds)
- Deployment credentials

## Performance Optimization

### Caching

The workflow uses caching for:
- npm dependencies (Node.js)
- pip dependencies (Python)

This significantly speeds up builds.

### Parallel Execution

Jobs run in parallel where possible:
- All tests run simultaneously
- Backend builds for all platforms run simultaneously
- Packaging for all platforms runs simultaneously

### Artifact Optimization

- Intermediate artifacts (7 days) are cleaned up automatically
- Release artifacts (30 days) are kept longer
- Consider implementing artifact cleanup for old releases

## Future Enhancements

Potential improvements to the CI/CD pipeline:

1. **Code Signing**: Add automated code signing for all platforms
2. **Auto-Update Server**: Deploy update metadata to hosting service
3. **Beta Channel**: Separate workflow for beta releases
4. **Nightly Builds**: Automated nightly builds from develop branch
5. **Performance Testing**: Add performance benchmarks to CI
6. **Security Scanning**: Add dependency vulnerability scanning
7. **Smoke Tests**: Add automated smoke tests for packaged apps
8. **Multi-Architecture**: Add ARM builds for Linux
9. **Installer Testing**: Automated installer testing in VMs
10. **Release Notes**: Auto-generate from commit messages

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [electron-builder Documentation](https://www.electron.build/)
- [PyInstaller Documentation](https://pyinstaller.org/)
- [Vite Documentation](https://vitejs.dev/)

## Support

For issues with the CI/CD pipeline:
1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Open an issue with relevant logs and error messages
