# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the FlashLearn project.

## Workflows

### 1. Desktop App Build & Package (`desktop-app-build.yml`)

**Purpose**: Build, test, and package the FlashLearn Desktop application for Windows, macOS, and Linux.

**Triggers**:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Version tags (e.g., `v1.0.0`)
- Manual trigger via GitHub Actions UI

**What it does**:
1. Runs all tests (Electron, Frontend, Backend)
2. Builds backend executables for all platforms
3. Builds frontend with Vite
4. Packages Electron app for Windows, macOS, and Linux
5. Creates GitHub Release (on version tags)

**Outputs**:
- Windows: Installer (.exe) and Portable (.exe)
- macOS: DMG disk images (x64 and arm64)
- Linux: AppImage, .deb, and .rpm packages

**Documentation**: See `electron/CI_CD_GUIDE.md` for detailed information.

### 2. Code Quality & Testing (`code-quality.yml`)

**Purpose**: Run code quality checks and tests for backend and frontend.

**Triggers**:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**What it does**:
1. Backend: Black, isort, Flake8, mypy, pytest
2. Frontend: ESLint, Prettier, Vitest
3. Security scanning with Trivy

### 3. Performance Benchmarks (`performance-benchmarks.yml`)

**Purpose**: Run performance benchmarks for the backend.

**Triggers**:
- Push to `main` branch
- Manual trigger

**What it does**:
1. Runs pytest-benchmark tests
2. Compares against baseline
3. Reports performance metrics

## Validation Scripts

### `validate-workflow.sh` (Linux/macOS)

Bash script to validate the desktop-app-build.yml workflow.

**Usage**:
```bash
chmod +x .github/workflows/validate-workflow.sh
./.github/workflows/validate-workflow.sh
```

### `validate-workflow.ps1` (Windows)

PowerShell script to validate the desktop-app-build.yml workflow.

**Usage**:
```powershell
powershell -ExecutionPolicy Bypass -File .github/workflows/validate-workflow.ps1
```

**What it checks**:
- Workflow file exists and is valid YAML
- All required jobs are present
- Triggers are configured correctly
- Artifact uploads are configured
- Release automation is set up
- Matrix builds are configured
- Dependency caching is enabled

## Quick Start

### Running Tests Locally

Before pushing, run tests locally:

```bash
# Electron tests
cd electron
npm test

# Frontend tests
cd frontend
npm test -- --run

# Backend tests
cd backend
pytest
```

### Creating a Release

1. Update version numbers in:
   - `electron/package.json`
   - `frontend/package.json`
   - `backend/pyproject.toml`

2. Update `CHANGELOG.md`

3. Commit and tag:
   ```bash
   git commit -am "Release v1.0.0"
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. The workflow will automatically:
   - Run all tests
   - Build for all platforms
   - Create GitHub Release
   - Upload all packages

See `.github/RELEASE_PROCESS.md` for detailed instructions.

## Monitoring Builds

1. Go to the **Actions** tab in GitHub
2. Select the workflow you want to monitor
3. Click on a specific run to see details
4. View logs for each job
5. Download artifacts from the summary page

## Troubleshooting

### Build Failures

**Tests failing**:
- Check test logs in the respective job
- Run tests locally to reproduce
- Fix issues and push again

**Backend build failing**:
- Check PyInstaller logs
- Verify `backend.spec` configuration
- Test locally: `python backend/build_backend.py`

**Packaging failing**:
- Check electron-builder logs
- Verify `electron/package.json` build config
- Test locally: `npm run build:win|mac|linux`

**Release failing**:
- Verify tag format: `v1.0.0` (must start with 'v')
- Check GitHub token permissions
- Ensure all platform builds succeeded

### Common Issues

**Missing dependencies**:
- Update `requirements.txt` or `package.json`
- Clear caches in GitHub Actions settings
- Re-run workflow

**Artifact not found**:
- Check if previous job succeeded
- Verify artifact name matches
- Check artifact upload logs

**Permission denied**:
- Check GitHub token permissions
- Verify repository settings
- Check branch protection rules

## Best Practices

### Before Pushing

1. Run tests locally
2. Validate workflow file (if modified)
3. Check for syntax errors
4. Review changes carefully

### For Pull Requests

1. Ensure all checks pass
2. Review build logs
3. Test packaged applications (if applicable)
4. Update documentation if needed

### For Releases

1. Follow the release process guide
2. Test on all platforms
3. Verify release notes
4. Announce release after verification

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [electron-builder Documentation](https://www.electron.build/)
- [PyInstaller Documentation](https://pyinstaller.org/)
- [Semantic Versioning](https://semver.org/)

## Support

For issues with workflows:
1. Check this README
2. Review workflow logs
3. Check documentation in `electron/CI_CD_GUIDE.md`
4. Open an issue with relevant logs

## Contributing

When modifying workflows:
1. Test changes on a fork first
2. Validate workflow file
3. Document changes
4. Update this README if needed
5. Test on all platforms if possible

## Maintenance

### Regular Tasks

- Review and update dependencies
- Monitor build times
- Clean up old artifacts
- Update documentation
- Review security advisories

### Optimization

- Use caching effectively
- Parallelize jobs where possible
- Minimize artifact sizes
- Use matrix builds for cross-platform
- Keep workflows DRY (Don't Repeat Yourself)

## Security

### Secrets

Never commit secrets to the repository. Use GitHub Secrets for:
- Code signing certificates
- API keys
- Deployment credentials

### Permissions

Workflows use minimal permissions by default. The release job requires:
- `contents: write` - To create releases

### Scanning

Security scanning is enabled via:
- Trivy vulnerability scanner
- Dependabot alerts
- CodeQL analysis (if enabled)

## Future Improvements

Planned enhancements:
- [ ] Code signing for all platforms
- [ ] Auto-update server deployment
- [ ] Beta release channel
- [ ] Nightly builds
- [ ] Performance regression detection
- [ ] Automated smoke tests
- [ ] Multi-architecture Linux builds
- [ ] Installer testing in VMs

## Questions?

For questions about workflows:
- Check documentation first
- Review existing issues
- Open a new issue with details
- Contact maintainers
