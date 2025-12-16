# Release Process

This document describes the process for creating a new release of FlashLearn Desktop.

## Pre-Release Checklist

Before creating a release, ensure:

- [ ] All tests pass locally
- [ ] All features are complete and tested
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated with release notes
- [ ] Version numbers are updated in:
  - [ ] `electron/package.json`
  - [ ] `frontend/package.json`
  - [ ] `backend/pyproject.toml`

## Version Numbering

FlashLearn follows [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Pre-release Versions

- **Alpha**: `v1.0.0-alpha.1` - Early testing, unstable
- **Beta**: `v1.0.0-beta.1` - Feature complete, testing
- **RC**: `v1.0.0-rc.1` - Release candidate, final testing

## Release Steps

### 1. Update Version Numbers

```bash
# Update electron/package.json
cd electron
npm version 1.0.0 --no-git-tag-version

# Update frontend/package.json
cd ../frontend
npm version 1.0.0 --no-git-tag-version

# Manually update backend/pyproject.toml
# Change: version = "1.0.0"
```

### 2. Update CHANGELOG.md

Add a new section at the top:

```markdown
## [1.0.0] - 2024-01-15

### Added
- New feature descriptions

### Changed
- Changed feature descriptions

### Fixed
- Bug fix descriptions

### Security
- Security fix descriptions
```

### 3. Commit Changes

```bash
git add .
git commit -m "Release v1.0.0"
git push origin main
```

### 4. Create and Push Tag

```bash
# Create annotated tag
git tag -a v1.0.0 -m "Release v1.0.0"

# Push tag to trigger release workflow
git push origin v1.0.0
```

### 5. Monitor Build

1. Go to GitHub Actions tab
2. Watch "Desktop App Build & Package" workflow
3. Verify all platform builds succeed
4. Check that release is created

### 6. Verify Release

1. Go to GitHub Releases page
2. Verify release notes are correct
3. Verify all platform packages are attached:
   - Windows installer (.exe)
   - Windows portable (.exe)
   - macOS DMG (x64 and arm64)
   - Linux AppImage
   - Linux .deb
   - Linux .rpm

### 7. Test Downloads

Download and test each package:

- **Windows**: Install and run the installer
- **macOS**: Open DMG and test the app
- **Linux**: Test AppImage or install deb/rpm

### 8. Announce Release

After verification:

1. Update website/documentation
2. Post announcement on social media
3. Notify users via email/newsletter
4. Update download links

## Hotfix Process

For urgent bug fixes:

1. Create hotfix branch from main: `git checkout -b hotfix/1.0.1`
2. Fix the bug and test
3. Update version to patch release (e.g., 1.0.1)
4. Update CHANGELOG.md
5. Merge to main: `git checkout main && git merge hotfix/1.0.1`
6. Follow normal release steps
7. Delete hotfix branch: `git branch -d hotfix/1.0.1`

## Beta Release Process

For beta releases:

1. Create beta branch: `git checkout -b beta/1.1.0-beta.1`
2. Update version to beta (e.g., 1.1.0-beta.1)
3. Commit and push
4. Create beta tag: `git tag v1.1.0-beta.1`
5. Push tag: `git push origin v1.1.0-beta.1`
6. Release will be marked as "pre-release" automatically

## Rollback Process

If a release has critical issues:

1. Delete the problematic tag:
   ```bash
   git tag -d v1.0.0
   git push origin :refs/tags/v1.0.0
   ```

2. Delete the GitHub Release (manually in GitHub UI)

3. Fix the issues

4. Create a new patch release (e.g., v1.0.1)

## Auto-Update Considerations

When releasing updates:

- **Breaking changes**: Users may need to reconfigure settings
- **Database migrations**: Ensure backward compatibility
- **API changes**: Document any API key requirement changes
- **File format changes**: Ensure old files can be read

## Release Channels

### Stable

- Main release channel
- Thoroughly tested
- Recommended for all users
- Tags: `v1.0.0`, `v1.1.0`, etc.

### Beta

- Pre-release testing
- Feature complete but may have bugs
- For early adopters
- Tags: `v1.1.0-beta.1`, etc.

### Alpha

- Early development
- Unstable, may have major bugs
- For developers and testers only
- Tags: `v1.1.0-alpha.1`, etc.

## Troubleshooting

### Build Fails

- Check GitHub Actions logs
- Verify all tests pass locally
- Ensure version numbers are consistent
- Check for missing dependencies

### Release Not Created

- Verify tag format: `v1.0.0` (must start with 'v')
- Check GitHub token permissions
- Ensure all platform builds succeeded
- Review release job logs

### Missing Artifacts

- Check platform-specific build logs
- Verify electron-builder configuration
- Ensure backend was built successfully
- Check artifact upload logs

### Auto-Update Not Working

- Verify release is published (not draft)
- Check update server configuration
- Ensure version number is higher than current
- Review auto-updater logs

## Post-Release Tasks

After a successful release:

- [ ] Monitor for bug reports
- [ ] Track download statistics
- [ ] Gather user feedback
- [ ] Plan next release
- [ ] Update roadmap
- [ ] Close completed issues
- [ ] Update project board

## Emergency Procedures

### Critical Security Issue

1. Immediately create hotfix
2. Release patch version ASAP
3. Notify users via all channels
4. Document the issue and fix
5. Consider deprecating old versions

### Build System Failure

1. Check GitHub Actions status
2. Review recent workflow changes
3. Test builds locally
4. Contact GitHub support if needed
5. Consider manual release if urgent

## Resources

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [electron-builder Publishing](https://www.electron.build/configuration/publish)

## Questions?

For questions about the release process:
- Check this document first
- Review CI/CD Guide (electron/CI_CD_GUIDE.md)
- Open an issue for clarification
- Contact the maintainers
