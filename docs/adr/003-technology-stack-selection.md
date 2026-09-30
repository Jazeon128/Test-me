# ADR-003: Technology Stack: FastAPI, React, and SQLite

## Status

Accepted

## Date

2024-10-01

## Context

The Test Me learning platform requires a technology stack that supports:
- Rapid development and iteration
- AI/ML integration for question generation
- Real-time user interactions
- Document parsing (PDF, DOCX, HTML, Markdown)
- Spaced repetition algorithm implementation
- Export to Anki format
- Future scalability

### Backend Framework Options

1. **Django**: Full-featured Python framework with ORM, admin panel
2. **Flask**: Lightweight Python framework, minimal structure
3. **FastAPI**: Modern Python framework with async support, automatic API docs
4. **Express.js**: Node.js framework, JavaScript ecosystem
5. **Ruby on Rails**: Convention-over-configuration, mature ecosystem

### Frontend Framework Options

1. **React**: Component-based, large ecosystem, flexible
2. **Vue.js**: Progressive framework, easier learning curve
3. **Angular**: Full-featured framework, TypeScript-first
4. **Svelte**: Compile-time framework, minimal runtime
5. **Next.js**: React with SSR, full-stack capabilities

### Database Options

1. **SQLite**: File-based, zero-config, embedded
2. **PostgreSQL**: Full-featured relational database
3. **MySQL**: Popular relational database
4. **MongoDB**: Document database, NoSQL
5. **Redis**: In-memory, key-value store

### Key Requirements

- **Developer productivity**: Fast iteration cycles
- **Type safety**: Catch errors early
- **API documentation**: Auto-generated, always up-to-date
- **Python ecosystem**: Access to AI/ML libraries (OpenAI, Anthropic, etc.)
- **Modern tooling**: Hot reload, debugging, testing
- **Deployment simplicity**: Easy to host and scale
- **Community support**: Active ecosystem, good documentation

## Decision

We will use the following technology stack:

### Backend: FastAPI (Python 3.9+)

**Rationale:**
- **Async support**: Native async/await for concurrent AI API calls
- **Type hints**: Pydantic models provide runtime validation and IDE support
- **Auto documentation**: OpenAPI/Swagger docs generated automatically
- **Performance**: Comparable to Node.js, faster than Django/Flask
- **Python ecosystem**: Direct access to AI libraries, data science tools
- **Modern**: Built on modern Python features (type hints, async)
- **Developer experience**: Excellent error messages, fast reload

### Frontend: React with Vite

**Rationale:**
- **Component model**: Reusable UI components for questions, decks, progress
- **Ecosystem**: Vast library ecosystem (React Router, state management)
- **Developer tools**: Excellent debugging and profiling tools
- **Community**: Largest community, most resources and examples
- **Flexibility**: Not opinionated, can structure as needed
- **Vite**: Fast build tool with instant HMR, better than Create React App
- **TypeScript ready**: Can add TypeScript incrementally if needed

### Database: SQLite (Development) / PostgreSQL (Production)

**Rationale:**
- **SQLite for development**:
  - Zero configuration, no separate database server
  - File-based, easy to backup and reset
  - Perfect for local development and testing
  - Sufficient for single-user scenarios
  
- **PostgreSQL for production**:
  - Handles concurrent users effectively
  - Advanced features (JSON, full-text search)
  - Proven scalability
  - Easy migration from SQLite via SQLAlchemy

### Supporting Technologies

- **SQLAlchemy**: ORM for database abstraction
- **Alembic**: Database migrations
- **Pydantic**: Data validation and settings management
- **Tailwind CSS**: Utility-first CSS framework
- **React Router**: Client-side routing
- **Axios**: HTTP client for API calls

## Consequences

### Positive Consequences

**FastAPI:**
- Automatic API documentation saves documentation effort
- Type hints catch errors before runtime
- Async support enables efficient AI API calls
- Fast development with auto-reload
- Easy to test with TestClient
- Modern Python features improve code quality

**React:**
- Component reusability reduces code duplication
- Large ecosystem provides solutions for common problems
- Virtual DOM provides good performance
- Easy to find developers with React experience
- Excellent debugging tools (React DevTools)
- Can incrementally adopt TypeScript

**SQLite/PostgreSQL:**
- SQLite simplifies local development setup
- No database server needed for development
- Easy to switch to PostgreSQL for production
- SQLAlchemy abstracts database differences
- File-based database easy to backup and version

### Negative Consequences

**FastAPI:**
- Newer framework, less mature than Django
- No built-in admin panel (unlike Django)
- Smaller ecosystem than Django
- Async programming has learning curve
- Less opinionated, need to make more decisions

**React:**
- Requires build tooling (Vite)
- More boilerplate than Vue or Svelte
- Need to choose state management solution
- JSX syntax has learning curve
- Frequent ecosystem changes

**SQLite:**
- Limited concurrent write performance
- No built-in replication
- Must migrate to PostgreSQL for production scale
- Some PostgreSQL features not available
- File locking issues on network drives

### Neutral Consequences

- **Python everywhere**: Backend and scripting in same language
- **JavaScript for frontend**: Separate language from backend
- **Build process**: Need Node.js for frontend builds
- **Deployment**: Need to deploy frontend and backend separately
- **Type systems**: Different type systems (Python vs JavaScript)

## Implementation Notes

### Project Structure

```
test-me/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers
│   │   ├── models/       # SQLAlchemy models
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Utilities
│   │   └── config.py     # Configuration
│   ├── tests/            # Backend tests
│   ├── alembic/          # Database migrations
│   ├── main.py           # FastAPI application
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API clients
│   │   └── App.jsx       # Root component
│   ├── package.json      # Node dependencies
│   └── vite.config.js    # Vite configuration
└── docker-compose.yml    # Development environment
```

### API Communication

```javascript
// Frontend API client
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const addSource = async (notebookId, file) => {
  const formData = new FormData();
  formData.append('files', file);
  return api.post(`/api/notebooks/${notebookId}/sources`, formData);
};
```

### Database Abstraction

```python
# SQLAlchemy models work with both SQLite and PostgreSQL
from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True)
    filename = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)
    # Works with both SQLite and PostgreSQL
```

### Development Workflow

```bash
# Start backend
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload

# Start frontend (separate terminal)
cd frontend
npm install
npm run dev

# Access application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Migration Path

If we need to change technologies:

**Backend alternatives:**
- FastAPI → Django: Rewrite routes as views, use Django ORM
- FastAPI → Flask: Similar structure, remove async features
- FastAPI → Node.js: Rewrite in TypeScript, use Express

**Frontend alternatives:**
- React → Vue: Similar component model, easier migration
- React → Next.js: Add SSR capabilities, minimal changes
- React → Svelte: Rewrite components, simpler syntax

**Database alternatives:**
- SQLite → PostgreSQL: Change connection string, run migrations
- PostgreSQL → MySQL: Minimal SQLAlchemy changes
- SQL → NoSQL: Major rewrite, not recommended

## References

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [ADR-004: Database Choice](004-database-choice-sqlite-vs-postgresql.md)
