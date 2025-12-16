# Contributing to FlashLearn

Thank you for your interest in contributing to FlashLearn! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Community](#community)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, gender identity, sexual orientation, disability, personal appearance, race, ethnicity, age, religion, or nationality.

### Our Standards

**Positive behaviors include:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behaviors include:**
- Harassment, trolling, or insulting comments
- Personal or political attacks
- Publishing others' private information
- Any conduct that could reasonably be considered inappropriate

### Enforcement

Instances of unacceptable behavior may be reported to the project maintainers. All complaints will be reviewed and investigated promptly and fairly.

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:
- Git installed and configured
- Node.js 18+ and npm
- Python 3.9+
- A GitHub account
- Familiarity with the technologies used (see README.md)

### Setting Up Your Development Environment

1. **Fork the Repository**
   - Visit [github.com/yourusername/flashlearn](https://github.com/yourusername/flashlearn)
   - Click the "Fork" button in the top-right corner

2. **Clone Your Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/flashlearn.git
   cd flashlearn
   ```

3. **Add Upstream Remote**
   ```bash
   git remote add upstream https://github.com/yourusername/flashlearn.git
   ```

4. **Set Up Development Environment**
   
   Follow the detailed setup instructions in [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)

5. **Verify Setup**
   ```bash
   # Run tests to ensure everything works
   cd backend && pytest
   cd ../frontend && npm test
   cd ../electron && npm test
   ```

---

## How to Contribute

### Types of Contributions

We welcome various types of contributions:

**Code Contributions:**
- Bug fixes
- New features
- Performance improvements
- Code refactoring

**Non-Code Contributions:**
- Documentation improvements
- Bug reports
- Feature requests
- Design suggestions
- Translations (future)
- Community support

### Finding Something to Work On

**Good First Issues:**
- Look for issues labeled `good first issue`
- These are beginner-friendly tasks
- Great for first-time contributors

**Help Wanted:**
- Issues labeled `help wanted` need community assistance
- May require more experience

**Feature Requests:**
- Check issues labeled `enhancement`
- Discuss implementation before starting

**Bug Reports:**
- Issues labeled `bug` need fixing
- Reproduce the bug first
- Add tests to prevent regression

### Reporting Bugs

**Before Submitting:**
1. Check if the bug has already been reported
2. Verify it's reproducible on the latest version
3. Collect relevant information

**Bug Report Template:**

```markdown
**Description:**
A clear description of the bug.

**Steps to Reproduce:**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior:**
What you expected to happen.

**Actual Behavior:**
What actually happened.

**Environment:**
- OS: [e.g., Windows 11, macOS 13, Ubuntu 22.04]
- FlashLearn Version: [e.g., 1.2.3]
- AI Provider: [e.g., OpenAI GPT-4]

**Screenshots:**
If applicable, add screenshots.

**Logs:**
Attach relevant log excerpts or diagnostic report.

**Additional Context:**
Any other relevant information.
```

### Suggesting Features

**Before Submitting:**
1. Check if the feature has been requested
2. Consider if it fits the project scope
3. Think about implementation challenges

**Feature Request Template:**

```markdown
**Problem Statement:**
Describe the problem this feature would solve.

**Proposed Solution:**
Describe your proposed solution.

**Alternatives Considered:**
What alternatives have you considered?

**Use Cases:**
Describe specific use cases for this feature.

**Additional Context:**
Any other relevant information, mockups, or examples.
```

---

## Development Workflow

### Branch Naming Convention

Use descriptive branch names:

```
<type>/<short-description>

Examples:
feature/add-image-support
fix/backend-startup-race-condition
docs/update-api-guide
refactor/simplify-settings-manager
test/add-property-tests-for-parser
```

### Workflow Steps

1. **Sync with Upstream**
   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Write code
   - Add tests
   - Update documentation
   - Follow coding standards

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```
   
   See [Commit Message Guidelines](#commit-message-guidelines) below

5. **Keep Branch Updated**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

6. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create Pull Request**
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Fill out the PR template
   - Link related issues

### Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

**Scope (optional):**
- `backend`: Backend changes
- `frontend`: Frontend changes
- `electron`: Electron changes
- `docs`: Documentation changes
- `build`: Build system changes

**Examples:**

```
feat(backend): add support for PowerPoint files

Implements PPTX parsing using python-pptx library.
Extracts text from slides and notes.

Closes #123
```

```
fix(electron): resolve backend startup race condition

The backend health check was starting before the process
was fully initialized. Added a small delay to ensure
the server is ready before checking.

Fixes #456
```

```
docs(user-guide): update API key configuration steps

Added screenshots and clarified the process for
obtaining API keys from each provider.
```

**Rules:**
- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter of subject
- No period at the end of subject
- Limit subject line to 72 characters
- Separate subject from body with blank line
- Wrap body at 72 characters
- Use body to explain what and why, not how

---

## Coding Standards

### Python (Backend)

**Style Guide:**
- Follow [PEP 8](https://pep8.org/)
- Use [Black](https://black.readthedocs.io/) for formatting
- Use [flake8](https://flake8.pycqa.org/) for linting
- Use [mypy](http://mypy-lang.org/) for type checking

**Formatting:**
```bash
cd backend
black .
flake8 .
mypy app/
```

**Code Conventions:**
- Use type hints for function signatures
- Write docstrings for public functions
- Keep functions small and focused
- Use meaningful variable names
- Avoid global state

**Example:**
```python
from typing import List, Optional

def parse_document(file_path: str, max_length: Optional[int] = None) -> List[str]:
    """
    Parse a document and extract text content.
    
    Args:
        file_path: Path to the document file
        max_length: Maximum length of extracted text (optional)
        
    Returns:
        List of text paragraphs extracted from the document
        
    Raises:
        FileNotFoundError: If the file doesn't exist
        ValueError: If the file format is unsupported
    """
    # Implementation
    pass
```

### JavaScript/TypeScript (Frontend/Electron)

**Style Guide:**
- Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- Use [Prettier](https://prettier.io/) for formatting
- Use [ESLint](https://eslint.org/) for linting

**Formatting:**
```bash
cd frontend  # or cd electron
npm run format
npm run lint
```

**Code Conventions:**
- Use ES6+ features
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for callbacks
- Use async/await over promises
- Write JSDoc comments for complex functions

**React Conventions:**
- Use functional components with hooks
- Keep components small and focused
- Use meaningful component names
- Extract reusable logic into custom hooks
- Use PropTypes or TypeScript for type checking

**Example:**
```javascript
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * SettingsDialog component for configuring API keys
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the dialog is open
 * @param {Function} props.onClose - Callback when dialog closes
 * @param {Function} props.onSave - Callback when settings are saved
 */
const SettingsDialog = ({ isOpen, onClose, onSave }) => {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('openai');

  useEffect(() => {
    // Load saved settings
    loadSettings();
  }, []);

  const handleSave = async () => {
    // Validate and save
    await onSave({ provider, apiKey });
    onClose();
  };

  return (
    // JSX
  );
};

SettingsDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default SettingsDialog;
```

### General Principles

**SOLID Principles:**
- Single Responsibility
- Open/Closed
- Liskov Substitution
- Interface Segregation
- Dependency Inversion

**DRY (Don't Repeat Yourself):**
- Extract common code into functions
- Use inheritance/composition appropriately
- Create reusable components

**KISS (Keep It Simple, Stupid):**
- Prefer simple solutions
- Avoid premature optimization
- Write readable code

**YAGNI (You Aren't Gonna Need It):**
- Don't add functionality until needed
- Focus on current requirements
- Avoid over-engineering

---

## Testing Requirements

### Test Coverage

**Minimum Coverage:**
- Backend: 80%
- Frontend: 70%
- Electron: 60%
- Critical paths: 100%

### Writing Tests

**Unit Tests:**
- Test individual functions/components
- Mock external dependencies
- Focus on edge cases
- Keep tests fast

**Integration Tests:**
- Test component interactions
- Use real dependencies where possible
- Test API endpoints
- Verify data flow

**Property-Based Tests:**
- Test universal properties
- Use Hypothesis (Python) or fast-check (JavaScript)
- Run 100+ iterations
- Tag with property reference

**Example Property Test:**
```python
from hypothesis import given, strategies as st

# Feature: standalone-desktop-app, Property 11: API key validation
@given(st.text().filter(lambda s: not s.startswith('sk-')))
def test_api_key_validation_rejects_invalid_formats(invalid_key):
    """
    Property: For any string that is not a valid API key format,
    attempting to save it as an API key should be rejected with an error.
    
    Validates: Requirements 4.2
    """
    result = validate_api_key(invalid_key)
    assert result is False
```

### Running Tests

**Before Submitting PR:**
```bash
# Backend
cd backend
pytest
pytest --cov=app --cov-report=html

# Frontend
cd frontend
npm test
npm run test:coverage

# Electron
cd electron
npm test
npm run test:coverage
```

**All Tests Must Pass:**
- Unit tests
- Integration tests
- Property-based tests
- Linting checks
- Type checks

---

## Documentation

### When to Update Documentation

Update documentation when:
- Adding new features
- Changing existing behavior
- Fixing bugs that affect users
- Adding configuration options
- Changing build process
- Updating dependencies

### Documentation Locations

**User Documentation:**
- `docs/USER_GUIDE.md` - Installation, usage, troubleshooting

**Developer Documentation:**
- `docs/DEVELOPER_GUIDE.md` - Setup, architecture, testing
- `CONTRIBUTING.md` - This file
- Inline code comments - Complex logic
- JSDoc/docstrings - Public APIs

**Architecture Decisions:**
- `docs/adr/` - Architecture Decision Records
- Use template in `docs/adr/template.md`

### Writing Good Documentation

**Be Clear:**
- Use simple language
- Avoid jargon
- Define technical terms
- Provide examples

**Be Complete:**
- Cover all use cases
- Include error scenarios
- Provide troubleshooting steps
- Add screenshots where helpful

**Be Accurate:**
- Test all instructions
- Keep documentation in sync with code
- Update when behavior changes
- Review regularly

---

## Pull Request Process

### Before Submitting

**Checklist:**
- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main
- [ ] No merge conflicts
- [ ] CHANGELOG.md updated (for significant changes)

### PR Template

When creating a PR, fill out this template:

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues
Closes #123
Relates to #456

## How Has This Been Tested?
Describe the tests you ran and how to reproduce them.

## Screenshots (if applicable)
Add screenshots for UI changes.

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where needed
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
- [ ] Any dependent changes have been merged
```

### Review Process

1. **Automated Checks**
   - CI/CD runs tests
   - Linting and formatting checks
   - Build verification
   - Must pass before review

2. **Code Review**
   - Maintainer reviews code
   - May request changes
   - Discussion in PR comments

3. **Address Feedback**
   - Make requested changes
   - Push new commits
   - Respond to comments

4. **Approval**
   - Maintainer approves PR
   - May request final changes

5. **Merge**
   - Maintainer merges PR
   - Branch is deleted
   - Changes appear in main

### After Merge

- Your contribution is now part of FlashLearn!
- You'll be credited in release notes
- Consider contributing more!

---

## Community

### Communication Channels

**GitHub:**
- Issues: Bug reports and feature requests
- Discussions: General questions and ideas
- Pull Requests: Code contributions

**Discord:**
- Real-time chat
- Community support
- Development discussions
- Join: [discord.gg/flashlearn](https://discord.gg/flashlearn)

**Email:**
- For private matters: support@flashlearn.com

### Getting Help

**Stuck on Something?**
1. Check documentation
2. Search existing issues
3. Ask in Discord
4. Create a GitHub discussion

**Want to Discuss an Idea?**
1. Create a GitHub discussion
2. Explain your idea
3. Get feedback from community
4. Create an issue if there's interest

### Recognition

**Contributors:**
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in About dialog

**Significant Contributors:**
- May be invited as collaborators
- Can help review PRs
- Shape project direction

---

## License

By contributing to FlashLearn, you agree that your contributions will be licensed under the MIT License.

---

## Questions?

If you have questions about contributing, feel free to:
- Open a GitHub discussion
- Ask in Discord
- Email us at support@flashlearn.com

Thank you for contributing to FlashLearn! 🎉
