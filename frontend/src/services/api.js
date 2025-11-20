import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Documents API
export const documentsAPI = {
  upload: (formData, onProgress) => {
    return api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    })
  },
  list: () => api.get('/documents/'),
  get: (id) => api.get(`/documents/${id}`),
  delete: (id) => api.delete(`/documents/${id}`),
}

// Decks API
export const decksAPI = {
  create: (data) => api.post('/decks/', data),
  list: () => api.get('/decks/'),
  get: (id) => api.get(`/decks/${id}`),
  update: (id, data) => api.put(`/decks/${id}`, data),
  delete: (id) => api.delete(`/decks/${id}`),
}

// Questions API
export const questionsAPI = {
  create: (data) => api.post('/questions/', data),
  get: (id) => api.get(`/questions/${id}`),
  getByDocument: (documentId) => api.get(`/questions/document/${documentId}`),
  delete: (id) => api.delete(`/questions/${id}`),
}



// Progress API
export const progressAPI = {
  submit: (data) => api.post('/progress/submit', data),
  getQuestion: (questionId) => api.get(`/progress/question/${questionId}`),
  getStats: () => api.get('/progress/stats'),
  getReviewSession: (numQuestions = 10, includeNew = true, includeReview = true, deckId = null) => {
    return api.post('/progress/review-session', {
      num_questions: numQuestions,
      include_new: includeNew,
      include_review: includeReview,
      deck_id: deckId,
    })
  },
}

// Tests API
export const testsAPI = {
  list: () => api.get('/tests/'),
  get: (id) => api.get(`/tests/${id}`),
  create: (data) => api.post('/tests/', data),
  delete: (id) => api.delete(`/tests/${id}`),
  exportAnki: (id) => api.get(`/tests/${id}/export/anki`, { responseType: 'blob' }),
  exportCSV: (id) => api.get(`/tests/${id}/export/csv`, { responseType: 'blob' }),
  exportAnkiCSV: (id) => api.get(`/tests/${id}/export/anki-csv`, { responseType: 'blob' }),
}

// Status API
export const statusAPI = {
  get: (jobId) => api.get(`/status/${jobId}`),
  getByDeck: (deckId) => api.get(`/status/deck/${deckId}`),
}

// Tags API
export const tagsAPI = {
  list: () => api.get('/tags/'),
  create: (data) => api.post('/tags/', data),
  delete: (tagId) => api.delete(`/tags/${tagId}`),
  addToQuestion: (questionId, tagId) => api.post(`/tags/questions/${questionId}/tags/${tagId}`),
  removeFromQuestion: (questionId, tagId) => api.delete(`/tags/questions/${questionId}/tags/${tagId}`),
}

export default api
