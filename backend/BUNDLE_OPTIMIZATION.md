# Backend Bundle Optimization

This document describes the optimization efforts for the PyInstaller backend bundle.

## Current Bundle Size

- **Total Size**: ~166 MB
- **Executable**: ~18 MB
- **Dependencies**: ~148 MB

## Optimization Attempts

### 1. Excluded Packages

The following packages were excluded from the bundle to reduce size:

**Test and Development Dependencies:**
- pytest, pytest_asyncio, pytest_cov, pytest_benchmark
- hypothesis
- black, flake8, isort, mypy
- pre_commit

**Unnecessary Standard Library:**
- tkinter
- unittest, test
- distutils, setuptools, pip

**Documentation Tools:**
- IPython, jupyter, notebook

**Large UI Libraries (attempted):**
- PyQt6 (attempted exclusion, but still pulled in by genanki)
- PyQt5

**Data Science Libraries (attempted):**
- pandas (attempted exclusion, but still pulled in by dependencies)
- scipy (attempted exclusion, but still pulled in by dependencies)
- matplotlib

### 2. UPX Compression

UPX compression is enabled in the spec file:
- Applied to the executable
- Applied to collected binaries

This provides some size reduction without affecting functionality.

## Why the Bundle is Large

The backend bundle is large primarily due to:

1. **Document Parsing Libraries**:
   - pdfplumber (with PIL/Pillow)
   - python-docx
   - python-pptx
   - lxml
   - pypdfium2

2. **AI Provider SDKs**:
   - anthropic
   - openai
   - google-generativeai (includes grpc, protobuf)

3. **Numerical Libraries**:
   - numpy (required by pdfplumber and other parsers)
   - Some scipy components (pulled in transitively)

4. **Qt Libraries**:
   - PyQt6 (pulled in by genanki for Anki export)
   - Includes Qt6WebEngineCore (~134 MB alone)

5. **Python Runtime**:
   - Python 3.9 standard library
   - Core dependencies

## Further Optimization Options

### Option 1: Remove Anki Export (Significant Savings)

If Anki export is not critical, removing `genanki` would eliminate PyQt6:

```python
# In requirements.txt, remove:
# genanki==0.13.1
```

**Estimated savings**: ~150 MB (PyQt6 and dependencies)

### Option 2: Lazy Loading

Implement lazy loading for heavy dependencies:
- Only import document parsers when needed
- Only import AI SDKs for the configured provider

This won't reduce bundle size but will improve startup time.

### Option 3: Separate Parsers

Create separate executables for different document types:
- Core backend (no parsers)
- PDF parser service
- Office document parser service

This would allow users to download only what they need.

### Option 4: Use Lighter Alternatives

Replace heavy dependencies with lighter alternatives:
- Use pypdf instead of pdfplumber (loses some features)
- Use markdown-only for text documents
- Remove PowerPoint support if not needed

### Option 5: Platform-Specific Builds

Build separate bundles for different use cases:
- Minimal: Text and markdown only (~50 MB)
- Standard: PDF and Office documents (~100 MB)
- Full: All document types and AI providers (~166 MB)

## Recommended Approach

For the Electron desktop app, the current bundle size (~166 MB) is acceptable:

1. **Modern Context**: Desktop apps of 100-200 MB are common
2. **One-Time Download**: Users download once, not on every update
3. **Full Functionality**: All features work out of the box
4. **No Dependencies**: Users don't need Python or other tools

### If Size is Critical

If bundle size must be reduced:

1. **Remove Anki Export**: Saves ~150 MB
   - Provide CSV export as alternative
   - Or implement Anki export in Electron layer

2. **Remove PowerPoint Support**: Saves ~20 MB
   - Less commonly used than PDF/Word

3. **Single AI Provider**: Saves ~30 MB
   - Only bundle the SDK for the configured provider
   - Require users to choose at install time

## Comparison with Other Apps

For context, here are sizes of popular Electron apps:

- **VS Code**: ~200-300 MB
- **Slack**: ~150-200 MB
- **Discord**: ~100-150 MB
- **Notion**: ~100-150 MB

Our backend bundle at ~166 MB is comparable and includes:
- Full Python runtime
- Multiple AI provider SDKs
- Comprehensive document parsing
- Database engine

## Testing After Optimization

After any optimization changes, always run:

```bash
python test_bundle.py
```

This ensures:
- Backend starts successfully
- HTTP endpoints respond
- Database initialization works
- All required dependencies are included

## Conclusion

The current bundle size of ~166 MB is reasonable for a desktop application with full functionality. Further optimization is possible but would require trade-offs in features or user experience.

For most users, the convenience of a single executable with all features outweighs the larger download size.
