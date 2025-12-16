# ADR-005: Standardize on "Deck" Terminology

## Status

Accepted

## Date

2024-11-20

## Context

The Test Me platform has inconsistent terminology for referring to collections of questions. Throughout the codebase, we use both "Test" and "Deck" interchangeably, causing confusion for developers and users.

### Current Inconsistencies

**Backend:**
- Database model: `Test` (table name: `tests`)
- API endpoint: `/api/tests/`
- Service methods: `create_test()`, `get_test_by_id()`
- Variable names: Mix of `test` and `deck`

**Frontend:**
- Component names: `TestCard`, `TestList`
- Route paths: `/tests/:id`
- State variables: Mix of `test` and `deck`
- UI labels: "Test" in some places, "Deck" in others

**Documentation:**
- README mentions both terms
- API docs use "Test"
- User-facing text inconsistent

### Problems with Current State

1. **Developer confusion**: New developers unsure which term to use
2. **Code search difficulty**: Must search for both terms
3. **Inconsistent UX**: Users see different terms in different places
4. **Maintenance burden**: Refactoring requires changing both terms
5. **API clarity**: Unclear what a "test" represents

### Terminology Options

1. **Test**: 
   - Pros: Current primary term, familiar to users
   - Cons: Ambiguous (unit test? quiz? exam?), conflicts with testing terminology

2. **Deck**:
   - Pros: Clear metaphor (deck of cards), used by Anki, no conflicts
   - Cons: Less familiar to non-Anki users, requires migration

3. **Quiz**:
   - Pros: Familiar term, clear meaning
   - Cons: Implies one-time assessment, not spaced repetition

4. **Collection**:
   - Pros: Generic, clear
   - Cons: Too generic, doesn't convey purpose

5. **Set**:
   - Pros: Simple, clear
   - Cons: Conflicts with Python `set` type, too generic

### Key Considerations

- **Anki compatibility**: We export to Anki format, which uses "Deck"
- **Spaced repetition context**: "Deck" is standard in SRS applications
- **Testing terminology**: "Test" conflicts with software testing
- **User mental model**: What metaphor makes sense?
- **Migration effort**: How much code needs to change?

## Decision

We will **standardize on "Deck"** as the primary term for collections of questions throughout the entire codebase, API, and user interface.

### Rationale

1. **Anki alignment**: Anki uses "Deck", and we export to Anki format
2. **SRS convention**: Most spaced repetition systems use "Deck"
3. **Clear metaphor**: Deck of flashcards is intuitive
4. **No conflicts**: Doesn't conflict with testing terminology
5. **Consistency**: One term everywhere reduces confusion

### Scope of Changes

**Backend:**
- Rename `Test` model to `Deck`
- Rename database table `tests` to `decks` (via migration)
- Update API endpoints: `/api/tests/` → `/api/decks/`
- Rename service methods: `create_test()` → `create_deck()`
- Update all variable names: `test` → `deck`
- Update docstrings and comments

**Frontend:**
- Rename components: `TestCard` → `DeckCard`, `TestList` → `DeckList`
- Update route paths: `/tests/:id` → `/decks/:id`
- Update state variables: `test` → `deck`
- Update UI labels: "Test" → "Deck"
- Update prop names and types

**Documentation:**
- Update README
- Update API documentation
- Update user guides
- Update code comments

**Database:**
- Create Alembic migration to rename table
- Preserve all existing data
- Update foreign key references

### Backward Compatibility

To maintain backward compatibility during transition:

1. **API versioning**: Support both endpoints temporarily
   ```python
   # New endpoint (preferred)
   @router.get("/api/decks/{deck_id}")
   
   # Old endpoint (deprecated, redirects)
   @router.get("/api/tests/{test_id}")
   async def get_test_deprecated(test_id: int):
       return RedirectResponse(url=f"/api/decks/{test_id}")
   ```

2. **Database migration**: Rename table without data loss
   ```python
   # Alembic migration
   def upgrade():
       op.rename_table('tests', 'decks')
   
   def downgrade():
       op.rename_table('decks', 'tests')
   ```

3. **Deprecation notices**: Add warnings to old endpoints
   ```python
   warnings.warn(
       "The /api/tests endpoint is deprecated. Use /api/decks instead.",
       DeprecationWarning
   )
   ```

## Consequences

### Positive Consequences

- **Consistency**: One term used everywhere
- **Clarity**: Clear what a "Deck" represents
- **Anki alignment**: Matches Anki terminology for exports
- **No conflicts**: Doesn't conflict with testing terminology
- **Better UX**: Users see consistent terminology
- **Easier onboarding**: New developers learn one term
- **Clearer code**: Variable names more meaningful
- **SRS convention**: Follows established patterns in spaced repetition

### Negative Consequences

- **Migration effort**: Significant refactoring required
- **Breaking changes**: API endpoints change
- **Documentation updates**: All docs need updating
- **User confusion**: Existing users see term change
- **Git history**: Harder to track changes across rename
- **Testing burden**: All tests need updating
- **Deployment coordination**: Frontend and backend must deploy together

### Neutral Consequences

- **Database migration**: One-time migration needed
- **API versioning**: Temporary support for old endpoints
- **Learning curve**: Users familiar with "Test" must adapt
- **Search and replace**: Bulk changes needed

## Implementation Notes

### Migration Plan

**Phase 1: Backend (Week 1)**
1. Create Alembic migration for table rename
2. Update SQLAlchemy model: `Test` → `Deck`
3. Update API routers: `/api/tests/` → `/api/decks/`
4. Add deprecated endpoints with redirects
5. Update service layer methods
6. Update all backend tests
7. Deploy backend with backward compatibility

**Phase 2: Frontend (Week 2)**
1. Update API client to use new endpoints
2. Rename components: `TestCard` → `DeckCard`, etc.
3. Update route paths: `/tests/` → `/decks/`
4. Update all UI labels and text
5. Update frontend tests
6. Deploy frontend

**Phase 3: Documentation (Week 3)**
1. Update README
2. Update API documentation
3. Update user guides
4. Add migration guide for API consumers
5. Update code comments

**Phase 4: Cleanup (Week 4)**
1. Remove deprecated endpoints
2. Remove backward compatibility code
3. Final documentation review
4. Announce completion

### Database Migration

```python
# alembic/versions/xxxx_rename_tests_to_decks.py
"""Rename tests table to decks

Revision ID: xxxx
Revises: yyyy
Create Date: 2024-11-20
"""

from alembic import op

def upgrade():
    # Rename table
    op.rename_table('tests', 'decks')
    
    # Update foreign key references if needed
    # (SQLAlchemy handles this automatically in most cases)

def downgrade():
    op.rename_table('decks', 'tests')
```

### API Backward Compatibility

```python
# backend/app/api/tests.py (deprecated)
from fastapi import APIRouter
from fastapi.responses import RedirectResponse
import warnings

router = APIRouter(prefix="/api/tests", tags=["tests (deprecated)"])

@router.get("/{test_id}")
async def get_test_deprecated(test_id: int):
    """
    Deprecated: Use /api/decks/{deck_id} instead.
    This endpoint will be removed in version 2.0.
    """
    warnings.warn(
        "The /api/tests endpoint is deprecated. Use /api/decks instead.",
        DeprecationWarning
    )
    return RedirectResponse(
        url=f"/api/decks/{test_id}",
        status_code=301  # Permanent redirect
    )
```

### Frontend Migration

```javascript
// Before
import TestCard from './components/TestCard';
import { getTest, createTest } from './services/api';

// After
import DeckCard from './components/DeckCard';
import { getDeck, createDeck } from './services/api';
```

### Search and Replace Strategy

Use careful search and replace to avoid false positives:

```bash
# Backend
# Replace model class
sed -i 's/class Test(/class Deck(/g' backend/app/models/*.py

# Replace variable names (be careful with "test" in testing context)
# Manual review recommended

# Frontend
# Replace component names
find frontend/src -type f -name "*.jsx" -exec sed -i 's/TestCard/DeckCard/g' {} +
find frontend/src -type f -name "*.jsx" -exec sed -i 's/TestList/DeckList/g' {} +
```

### Testing Strategy

1. **Unit tests**: Update all test names and assertions
2. **Integration tests**: Test both old and new endpoints during transition
3. **E2E tests**: Update user flows to use new terminology
4. **Migration tests**: Verify database migration preserves data
5. **Backward compatibility tests**: Verify redirects work correctly

### Communication Plan

1. **Internal announcement**: Notify team of terminology change
2. **API changelog**: Document breaking changes
3. **Migration guide**: Provide guide for API consumers
4. **User notification**: In-app message about terminology change
5. **Documentation**: Update all user-facing docs

### Rollback Plan

If issues arise:
1. Revert database migration: `alembic downgrade -1`
2. Redeploy previous backend version
3. Redeploy previous frontend version
4. Restore old API endpoints
5. Document issues and plan fixes

## References

- [Anki Manual: Decks](https://docs.ankiweb.net/getting-started.html#decks)
- [SuperMemo: Collections](https://supermemo.guru/wiki/Collection)
- [Naming Standardization Summary](../.kiro/specs/codebase-quality-improvements/NAMING_STANDARDIZATION_SUMMARY.md)
- [Requirements: Naming Consistency](../.kiro/specs/codebase-quality-improvements/requirements.md#requirement-3)
- [API Migration Guide](../backend/docs/API_MIGRATION_GUIDE.md) (to be created)
