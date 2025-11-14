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
  get: (id) => api.get(`/questions/${id}`),
  getByDocument: (documentId) => api.get(`/questions/document/${documentId}`),
  delete: (id) => api.delete(`/questions/${id}`),
}

// Tests API
export const testsAPI = {
  create: (data) => api.post('/tests/', data),
  list: () => api.get('/tests/'),
  get: (id) => api.get(`/tests/${id}`),
  delete: (id) => api.delete(`/tests/${id}`),
  start: (id, timeLimit = 30) => api.post(`/tests/${id}/start`, null, {
    params: { time_limit_seconds: timeLimit }
  }),
  exportAnki: (id) => api.get(`/tests/${id}/export/anki`, {
    responseType: 'blob'
  }),
}

// Progress API
export const progressAPI = {
  submit: (data) => api.post('/progress/submit', data),
  getQuestion: (questionId) => api.get(`/progress/question/${questionId}`),
  getStats: () => api.get('/progress/stats'),
  getReviewSession: (numQuestions = 10, includeNew = true, includeReview = true) => {
    return api.post('/progress/review-session', {
      num_questions: numQuestions,
      include_new: includeNew,
      include_review: includeReview,
    })
  },
}

export default api
