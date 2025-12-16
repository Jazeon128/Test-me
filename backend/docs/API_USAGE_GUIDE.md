# Test Me API Usage Guide

## Overview

The Test Me API provides endpoints for managing documents, generating questions, tracking progress, and exporting study materials. This guide covers common use cases and provides examples for each endpoint.

## Base URL

```
http://localhost:8000/api
```

## Authentication

Currently, the API does not require authentication. This may change in future versions.

## Common Workflows

### 1. Upload a Document and Generate Questions

**Step 1: Upload a document**

```bash
curl -X POST "http://localhost:8000/api/documents/upload" \
  -F "file=@study_guide.pdf" \
  -F "num_questions=10" \
  -F "difficulty=medium"
```

Response:
```json
{
  "document_id": 5,
  "filename": "study_guide.pdf",
  "file_type": "pdf",
  "status": "processing",
  "message": "Document uploaded successfully. Questions are being generated."
}
```

**Step 2: Check generation status**

```bash
curl "http://localhost:8000/api/documents/5/status"
```

Response:
```json
{
  "status": "completed",
  "progress": 100,
  "questions_generated": 10,
  "deck_id": 12
}
```

**Step 3: Get the generated questions**

```bash
curl "http://localhost:8000/api/questions/document/5"
```

### 2. Create a Study Session

**Step 1: Get due questions**

```bash
curl "http://localhost:8000/api/progress/due?limit=20"
```

**Step 2: Submit an answer**

```bash
curl -X POST "http://localhost:8000/api/progress/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "question_id": 123,
    "selected_option": "A",
    "time_taken_seconds": 15.5
  }'
```

Response:
```json
{
  "correct": true,
  "correct_answer": "A",
  "explanation": "Paris is the capital of France.",
  "next_review_date": "2024-01-20T10:30:00Z",
  "mastery_percentage": 75,
  "streak": 3
}
```

### 3. Export to Anki

```bash
curl "http://localhost:8000/api/decks/12/export/anki" \
  --output my_deck.apkg
```

## API Endpoints Reference

### Documents

#### Upload Document
- **POST** `/api/documents/upload`
- **Description**: Upload a document and optionally generate questions
- **Parameters**:
  - `file` (required): Document file (PDF, DOCX, HTML, MD, PPTX)
  - `num_questions` (optional): Number of questions to generate (default: 10)
  - `difficulty` (optional): Question difficulty (easy, medium, hard, mixed)
  - `custom_prompt` (optional): Custom instructions for question generation

#### Get Document
- **GET** `/api/documents/{document_id}`
- **Description**: Get document details and metadata

#### List Documents
- **GET** `/api/documents/`
- **Description**: List all uploaded documents
- **Query Parameters**:
  - `skip`: Pagination offset (default: 0)
  - `limit`: Number of results (default: 100)

#### Delete Document
- **DELETE** `/api/documents/{document_id}`
- **Description**: Delete a document and all associated questions

### Questions

#### Create Question
- **POST** `/api/questions/`
- **Description**: Create a custom question manually
- **Body**:
```json
{
  "question_text": "What is the capital of France?",
  "options": [
    {"text": "Paris", "is_correct": true},
    {"text": "London", "is_correct": false},
    {"text": "Berlin", "is_correct": false},
    {"text": "Madrid", "is_correct": false}
  ],
  "explanation": "Paris is the capital of France.",
  "difficulty": "easy"
}
```

#### Get Question
- **GET** `/api/questions/{question_id}`
- **Description**: Get a single question with all options

#### Get Document Questions
- **GET** `/api/questions/document/{document_id}`
- **Description**: Get all questions for a document
- **Query Parameters**:
  - `skip`: Pagination offset
  - `limit`: Number of results
  - `difficulty`: Filter by difficulty

#### Delete Question
- **DELETE** `/api/questions/{question_id}`
- **Description**: Delete a question permanently

### Progress & Spaced Repetition

#### Submit Answer
- **POST** `/api/progress/submit`
- **Description**: Submit an answer and update spaced repetition data
- **Body**:
```json
{
  "question_id": 123,
  "selected_option": "A",
  "time_taken_seconds": 15.5,
  "manual_quality": 4
}
```

#### Get Progress
- **GET** `/api/progress/{question_id}`
- **Description**: Get progress data for a specific question

#### Get Due Questions
- **GET** `/api/progress/due`
- **Description**: Get questions that are due for review
- **Query Parameters**:
  - `limit`: Maximum number of questions (default: 20)

#### Get Statistics
- **GET** `/api/progress/stats`
- **Description**: Get overall learning statistics

### Decks

#### Create Deck
- **POST** `/api/decks/`
- **Description**: Create a new deck
- **Body**:
```json
{
  "name": "French Geography",
  "description": "Questions about French geography and culture"
}
```

#### Get Deck
- **GET** `/api/decks/{deck_id}`
- **Description**: Get deck details and questions

#### List Decks
- **GET** `/api/decks/`
- **Description**: List all decks

#### Update Deck
- **PUT** `/api/decks/{deck_id}`
- **Description**: Update deck name or description

#### Delete Deck
- **DELETE** `/api/decks/{deck_id}`
- **Description**: Delete a deck (questions remain)

#### Export to Anki
- **GET** `/api/decks/{deck_id}/export/anki`
- **Description**: Export deck as Anki .apkg file

#### Export to CSV
- **GET** `/api/decks/{deck_id}/export/csv`
- **Description**: Export deck as CSV file

### Settings

#### Get Settings
- **GET** `/api/settings/`
- **Description**: Get all application settings

#### Update Setting
- **PUT** `/api/settings/{key}`
- **Description**: Update a specific setting
- **Body**:
```json
{
  "value": "anthropic"
}
```

#### Test AI Connection
- **POST** `/api/settings/test-ai`
- **Description**: Test AI provider connection

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": {
      "field": "specific_field",
      "reason": "why it failed"
    },
    "request_id": "uuid-for-tracking"
  }
}
```

### Common Error Codes

- `BAD_REQUEST` (400): Invalid request parameters
- `UNAUTHORIZED` (401): Authentication required
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (422): Request validation failed
- `INTERNAL_SERVER_ERROR` (500): Server error
- `AI_SERVICE_ERROR` (502): AI provider error

## Rate Limiting

Currently, there are no rate limits. This may change in production.

## Best Practices

### 1. Pagination

Always use pagination for list endpoints:

```bash
# Get first page
curl "http://localhost:8000/api/documents/?skip=0&limit=20"

# Get second page
curl "http://localhost:8000/api/documents/?skip=20&limit=20"
```

### 2. Error Handling

Always check the response status code and handle errors appropriately:

```python
import requests

response = requests.post("http://localhost:8000/api/documents/upload", files={"file": file})

if response.status_code == 200:
    data = response.json()
    print(f"Document uploaded: {data['document_id']}")
elif response.status_code == 400:
    error = response.json()
    print(f"Validation error: {error['error']['message']}")
else:
    print(f"Unexpected error: {response.status_code}")
```

### 3. Async Operations

Document upload and question generation are async operations. Always check the status:

```python
import time
import requests

# Upload document
response = requests.post("http://localhost:8000/api/documents/upload", files={"file": file})
document_id = response.json()["document_id"]

# Poll for completion
while True:
    status_response = requests.get(f"http://localhost:8000/api/documents/{document_id}/status")
    status = status_response.json()["status"]
    
    if status == "completed":
        print("Questions generated successfully!")
        break
    elif status == "failed":
        print("Generation failed")
        break
    
    time.sleep(2)  # Wait 2 seconds before checking again
```

### 4. Spaced Repetition

For optimal learning, always submit answers with accurate timing:

```python
import time

start_time = time.time()
# User answers question
time_taken = time.time() - start_time

requests.post("http://localhost:8000/api/progress/submit", json={
    "question_id": 123,
    "selected_option": "A",
    "time_taken_seconds": time_taken
})
```

## SDK Examples

### Python

```python
import requests

class TestMeClient:
    def __init__(self, base_url="http://localhost:8000/api"):
        self.base_url = base_url
    
    def upload_document(self, file_path, num_questions=10, difficulty="medium"):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {
                'num_questions': num_questions,
                'difficulty': difficulty
            }
            response = requests.post(f"{self.base_url}/documents/upload", files=files, data=data)
            return response.json()
    
    def get_due_questions(self, limit=20):
        response = requests.get(f"{self.base_url}/progress/due", params={'limit': limit})
        return response.json()
    
    def submit_answer(self, question_id, selected_option, time_taken):
        data = {
            'question_id': question_id,
            'selected_option': selected_option,
            'time_taken_seconds': time_taken
        }
        response = requests.post(f"{self.base_url}/progress/submit", json=data)
        return response.json()

# Usage
client = TestMeClient()
result = client.upload_document("study_guide.pdf", num_questions=15)
print(f"Document ID: {result['document_id']}")
```

### JavaScript

```javascript
class TestMeClient {
  constructor(baseUrl = 'http://localhost:8000/api') {
    this.baseUrl = baseUrl;
  }

  async uploadDocument(file, numQuestions = 10, difficulty = 'medium') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('num_questions', numQuestions);
    formData.append('difficulty', difficulty);

    const response = await fetch(`${this.baseUrl}/documents/upload`, {
      method: 'POST',
      body: formData
    });

    return response.json();
  }

  async getDueQuestions(limit = 20) {
    const response = await fetch(`${this.baseUrl}/progress/due?limit=${limit}`);
    return response.json();
  }

  async submitAnswer(questionId, selectedOption, timeTaken) {
    const response = await fetch(`${this.baseUrl}/progress/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_id: questionId,
        selected_option: selectedOption,
        time_taken_seconds: timeTaken
      })
    });

    return response.json();
  }
}

// Usage
const client = new TestMeClient();
const result = await client.uploadDocument(fileInput.files[0], 15);
console.log(`Document ID: ${result.document_id}`);
```

## Support

For issues or questions:
- GitHub Issues: [repository-url]
- Documentation: [docs-url]
- Email: support@testme.app

## Changelog

### v0.1.0 (Current)
- Initial API release
- Document upload and parsing
- AI question generation
- Spaced repetition (SM-2 algorithm)
- Anki and CSV export
- Progress tracking
