# Environment Variables Documentation

This document provides comprehensive documentation for all environment variables used in the Test Me platform.

## Table of Contents

- [Quick Start](#quick-start)
- [Required Variables](#required-variables)
- [Optional Variables](#optional-variables)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Validation](#validation)
- [Examples](#examples)

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set at least one AI API key:
   ```bash
   ANTHROPIC_API_KEY=your_api_key_here
   AI_PROVIDER=anthropic
   ```

3. The application will validate your configuration on startup and provide clear error messages if anything is misconfigured.

## Required Variables

These variables must be properly configured for the application to function.

### AI Configuration

#### `ANTHROPIC_API_KEY`
- **Description**: API key for Anthropic Claude
- **Required**: At least one AI provider key must be set
- **Default**: (empty string)
- **Example**: `sk-ant-api03-...`
- **Get Key**: https://console.anthropic.com/

#### `OPENAI_API_KEY`
- **Description**: API key for OpenAI GPT models
- **Required**: At least one AI provider key must be set
- **Default**: (empty string)
- **Example**: `sk-proj-...`
- **Get Key**: https://platform.openai.com/

#### `GEMINI_API_KEY`
- **Description**: API key for Google Gemini
- **Required**: At least one AI provider key must be set
- **Default**: (empty string)
- **Example**: `AIza...`
- **Get Key**: https://makersuite.google.com/

#### `AI_PROVIDER`
- **Description**: Which AI provider to use for question generation
- **Required**: Yes
- **Default**: `anthropic`
- **Valid Values**: `anthropic`, `openai`, `gemini`
- **Example**: `AI_PROVIDER=anthropic`
- **Note**: The selected provider must have a corresponding API key configured

## Optional Variables

These variables have sensible defaults but can be customized as needed.

### AI Configuration

#### `AI_MODEL`
- **Description**: Specific AI model to use (overrides provider default)
- **Required**: No
- **Default**: (empty - uses provider default)
- **Examples**:
  - Anthropic: `claude-3-sonnet-20240229`, `claude-3-opus-20240229`, `claude-3-haiku-20240307`
  - OpenAI: `gpt-4`, `gpt-4-turbo-preview`, `gpt-3.5-turbo`
  - Gemini: `gemini-pro`, `gemini-pro-vision`

### Database Configuration

#### `DATABASE_URL`
- **Description**: Database connection string
- **Required**: No
- **Default**: `sqlite:///./test_me.db`
- **Examples**:
  - SQLite: `sqlite:///./test_me.db`
  - PostgreSQL: `postgresql://user:password@localhost:5432/testme`
  - PostgreSQL (Docker): `postgresql://testme_user:testme_password@db:5432/testme`
- **Note**: PostgreSQL is recommended for production; SQLite is fine for development

### Application Configuration

#### `DEBUG`
- **Description**: Enable debug mode with detailed error messages
- **Required**: No
- **Default**: `true`
- **Valid Values**: `true`, `false`
- **Recommendation**: 
  - Development: `true`
  - Production: `false`

#### `SECRET_KEY`
- **Description**: Secret key for session management and security features
- **Required**: Yes (must be changed in production)
- **Default**: `dev-secret-key-change-in-production`
- **Generate**: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- **Security**: 
  - MUST be changed from default in production
  - Should be a long, random string
  - Keep this value secret and secure

#### `CORS_ORIGINS_STR`
- **Description**: Comma-separated list of allowed CORS origins
- **Required**: No
- **Default**: `http://localhost:5173,http://localhost:3000`
- **Examples**:
  - Development: `http://localhost:5173,http://localhost:3000`
  - Production: `https://app.example.com,https://www.example.com`
- **Note**: Spaces around commas are automatically trimmed

#### `ENVIRONMENT`
- **Description**: Application environment/deployment stage
- **Required**: No
- **Default**: `development`
- **Valid Values**: `development`, `staging`, `production`
- **Usage**: Affects logging, error handling, and validation behavior

#### `LOG_LEVEL`
- **Description**: Logging verbosity level
- **Required**: No
- **Default**: `INFO`
- **Valid Values**: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`
- **Recommendations**:
  - Development: `DEBUG` (most verbose)
  - Staging: `INFO`
  - Production: `WARNING` or `ERROR` (least verbose)
- **Note**: Case-insensitive

### File Upload Configuration

#### `MAX_UPLOAD_SIZE`
- **Description**: Maximum file upload size in bytes
- **Required**: No
- **Default**: `10485760` (10 MB)
- **Examples**:
  - 5 MB: `5242880`
  - 10 MB: `10485760`
  - 20 MB: `20971520`
  - 50 MB: `52428800`
  - 100 MB: `104857600`
- **Note**: Must be a positive integer

#### `UPLOAD_DIR`
- **Description**: Directory path for storing uploaded files
- **Required**: No
- **Default**: `./uploads`
- **Examples**:
  - Local: `./uploads`
  - Docker: `/app/uploads`
  - Absolute path: `/var/app/uploads`
- **Note**: Directory will be created automatically if it doesn't exist

## Environment-Specific Configuration

### Development Environment

Recommended configuration for local development:

```bash
# AI Configuration
ANTHROPIC_API_KEY=your_dev_api_key
AI_PROVIDER=anthropic

# Application
DEBUG=true
SECRET_KEY=dev-secret-key-change-in-production
CORS_ORIGINS_STR=http://localhost:5173,http://localhost:3000
ENVIRONMENT=development
LOG_LEVEL=DEBUG

# Database
DATABASE_URL=sqlite:///./test_me.db

# File Upload
MAX_UPLOAD_SIZE=10485760
UPLOAD_DIR=./uploads
```

### Staging Environment

Recommended configuration for staging/testing:

```bash
# AI Configuration
ANTHROPIC_API_KEY=your_staging_api_key
AI_PROVIDER=anthropic

# Application
DEBUG=true
SECRET_KEY=your-secure-staging-secret-key
CORS_ORIGINS_STR=https://staging.example.com
ENVIRONMENT=staging
LOG_LEVEL=INFO

# Database
DATABASE_URL=postgresql://user:password@staging-db.example.com:5432/testme

# File Upload
MAX_UPLOAD_SIZE=20971520
UPLOAD_DIR=/var/app/uploads
```

### Production Environment

Recommended configuration for production:

```bash
# AI Configuration
ANTHROPIC_API_KEY=your_production_api_key
AI_PROVIDER=anthropic

# Application
DEBUG=false
SECRET_KEY=your-secure-random-production-secret-key
CORS_ORIGINS_STR=https://app.example.com,https://www.example.com
ENVIRONMENT=production
LOG_LEVEL=WARNING

# Database
DATABASE_URL=postgresql://user:password@prod-db.example.com:5432/testme

# File Upload
MAX_UPLOAD_SIZE=20971520
UPLOAD_DIR=/var/app/uploads
```

### Docker Environment

When using Docker Compose, most variables are configured in `docker-compose.yml`:

```bash
# Only these need to be in .env file:
ANTHROPIC_API_KEY=your_api_key
AI_PROVIDER=anthropic
AI_MODEL=

# Optional overrides:
DEBUG=true
SECRET_KEY=dev-secret-key
LOG_LEVEL=INFO
ENVIRONMENT=development
MAX_UPLOAD_SIZE=10485760
```

## Validation

The application performs comprehensive validation of environment variables on startup.

### Validation Rules

1. **AI Provider**: Must be one of `anthropic`, `openai`, or `gemini`
2. **API Keys**: At least one AI provider API key must be configured
3. **Provider Key Match**: The selected `AI_PROVIDER` must have a corresponding API key
4. **Secret Key**: Must be changed from default value in production environment
5. **Log Level**: Must be one of `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`
6. **Environment**: Must be one of `development`, `staging`, `production`
7. **Upload Size**: Must be a positive integer

### Validation Errors

If validation fails, the application will:
1. Print clear error messages to stderr
2. List all validation errors found
3. Exit with status code 1
4. Provide guidance on how to fix the issues

Example error output:
```
================================================================================
CONFIGURATION VALIDATION ERRORS
================================================================================
1. AI_PROVIDER is set to 'anthropic' but ANTHROPIC_API_KEY is not configured
2. SECRET_KEY must be changed from default value in production environment
3. LOG_LEVEL must be one of: DEBUG, INFO, WARNING, ERROR, CRITICAL. Got: INVALID
================================================================================

Please check your .env file and fix the above errors.
See .env.example for reference.
```

## Examples

### Example 1: Basic Setup with Anthropic

```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
AI_PROVIDER=anthropic
```

### Example 2: Using OpenAI with Custom Model

```bash
OPENAI_API_KEY=sk-proj-your-key-here
AI_PROVIDER=openai
AI_MODEL=gpt-4-turbo-preview
```

### Example 3: Production Setup with PostgreSQL

```bash
# AI Configuration
ANTHROPIC_API_KEY=sk-ant-api03-production-key
AI_PROVIDER=anthropic
AI_MODEL=claude-3-opus-20240229

# Application
DEBUG=false
SECRET_KEY=Xk7mP9qR2tY5wZ8aB3cD6eF1gH4jK7mN0pQ3sT6vW9yA2bC5dE8fG1hJ4kL7nM0
CORS_ORIGINS_STR=https://app.example.com,https://www.example.com
ENVIRONMENT=production
LOG_LEVEL=ERROR

# Database
DATABASE_URL=postgresql://testme_prod:secure_password@prod-db.example.com:5432/testme_prod

# File Upload
MAX_UPLOAD_SIZE=52428800
UPLOAD_DIR=/var/app/uploads
```

### Example 4: Multiple AI Providers

```bash
# Configure all providers (can switch between them)
ANTHROPIC_API_KEY=sk-ant-api03-your-key
OPENAI_API_KEY=sk-proj-your-key
GEMINI_API_KEY=AIza-your-key

# Use Anthropic by default
AI_PROVIDER=anthropic

# Can change to openai or gemini without reconfiguring keys
```

## Troubleshooting

### "At least one AI API key must be configured"

**Solution**: Set at least one of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY` in your `.env` file.

### "AI_PROVIDER is set to 'X' but X_API_KEY is not configured"

**Solution**: Either:
1. Set the API key for the selected provider, or
2. Change `AI_PROVIDER` to a provider that has an API key configured

### "SECRET_KEY must be changed from default value in production"

**Solution**: Generate a secure secret key:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
Then set it in your `.env` file.

### "LOG_LEVEL must be one of: DEBUG, INFO, WARNING, ERROR, CRITICAL"

**Solution**: Check for typos in your `LOG_LEVEL` value. It must be one of the valid values (case-insensitive).

### Environment variables not being loaded

**Solution**: 
1. Ensure `.env` file exists in the backend directory
2. Check that variable names match exactly (case-sensitive)
3. Restart the application after changing `.env`
4. For Docker, rebuild containers: `docker-compose up -d --build`

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use different API keys** for development, staging, and production
3. **Rotate API keys regularly** in production
4. **Use strong, random SECRET_KEY** values
5. **Restrict CORS_ORIGINS** to only necessary domains
6. **Use environment-specific configurations** (don't use debug mode in production)
7. **Store production secrets** in secure secret management systems (AWS Secrets Manager, HashiCorp Vault, etc.)
8. **Limit file upload sizes** to prevent abuse
9. **Use HTTPS** for all production URLs in CORS_ORIGINS_STR
10. **Monitor API usage** and set up billing alerts

## Additional Resources

- [Pydantic Settings Documentation](https://docs.pydantic.dev/latest/usage/settings/)
- [FastAPI Configuration](https://fastapi.tiangolo.com/advanced/settings/)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [Google AI Documentation](https://ai.google.dev/)
