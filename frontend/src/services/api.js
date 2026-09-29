import axios from 'axios'

/**
 * Initialize API client with dynamic backend URL
 * In Electron, we get the backend port from the main process
 * In web mode, we use the default /api path
 */
const DEFAULT_BASE_URL = '/api'

const api = axios.create({
  baseURL: DEFAULT_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Resolve the Electron backend URL once, on the first request.
 * Resolving at module scope would need a top-level await, which esbuild cannot
 * transpile for the browser targets this app builds against.
 */
let baseURLReady = null

const ensureBaseURL = () => {
  if (!window.electronAPI) return Promise.resolve(api.defaults.baseURL)
  if (!baseURLReady) baseURLReady = updateBaseURL()
  return baseURLReady
}

api.interceptors.request.use(async (config) => {
  await ensureBaseURL()
  return config
})

/**
 * API Error Handler
 * Intercepts API errors and provides user-friendly error messages
 * Implements Requirements 6.3: API error handling with suggested actions
 */

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract error information
    const status = error.response?.status
    // The backend's error handler nests the reason under error.message.
    // Plain FastAPI responses use detail. Read both so the reason is not lost.
    const data = error.response?.data
    const message = data?.error?.message || data?.detail || data?.message || error.message
    const url = error.config?.url

    // Create user-friendly error object
    const userError = {
      originalError: error,
      status,
      message,
      url,
      userMessage: '',
      suggestedActions: [],
    }

    // Provide user-friendly messages and suggested actions based on error type
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      userError.userMessage = 'Unable to connect to the backend server. The server may not be running.'
      userError.suggestedActions = [
        'Check if the application is fully started',
        'Try restarting the application',
        'Check the application logs for backend errors',
      ]
    } else if (status === 400) {
      userError.userMessage = 'Invalid request. Please check your input and try again.'
      userError.suggestedActions = [
        'Verify that all required fields are filled correctly',
        'Check that file formats are supported',
        'Ensure data is in the correct format',
      ]
    } else if (status === 401) {
      userError.userMessage = 'Authentication failed. Please check your API key configuration.'
      userError.suggestedActions = [
        'Verify your API key is correct',
        'Check that your API key has not expired',
        'Try reconfiguring your API key in settings',
      ]
    } else if (status === 403) {
      userError.userMessage = 'Access denied. You do not have permission to perform this action.'
      userError.suggestedActions = [
        'Check your API key permissions',
        'Verify your account has the necessary access',
        'Contact support if you believe this is an error',
      ]
    } else if (status === 404) {
      userError.userMessage = 'The requested resource was not found.'
      userError.suggestedActions = [
        'Verify the resource exists',
        'Try refreshing the page',
        'Check if the resource was deleted',
      ]
    } else if (status === 429) {
      userError.userMessage = 'Too many requests. Please slow down and try again later.'
      userError.suggestedActions = [
        'Wait a few minutes before trying again',
        'Check your API rate limits',
        'Consider upgrading your API plan if needed',
      ]
    } else if (status === 500) {
      userError.userMessage = 'An internal server error occurred. This is not your fault.'
      userError.suggestedActions = [
        'Try again in a few moments',
        'Check the application logs for details',
        'Report this issue if it persists',
      ]
    } else if (status === 503) {
      userError.userMessage = 'The service is temporarily unavailable. Please try again later.'
      userError.suggestedActions = [
        'Wait a few minutes and try again',
        'Check if the AI service is experiencing issues',
        'Try using a different AI provider',
      ]
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      userError.userMessage = 'The request timed out. The operation took too long to complete.'
      userError.suggestedActions = [
        'Try again with a smaller file or fewer questions',
        'Check your internet connection',
        'Increase the timeout in settings if available',
      ]
    } else {
      userError.userMessage = message || 'An unexpected error occurred. Please try again.'
      userError.suggestedActions = [
        'Try the operation again',
        'Check the application logs for more details',
        'Report this issue if it continues to occur',
      ]
    }

    // Log error for debugging
    console.error('API Error:', {
      status,
      message,
      url,
      userMessage: userError.userMessage,
    })

    // Reject with enhanced error
    return Promise.reject(userError)
  }
)

/**
 * Update the API base URL dynamically
 * This is useful when the backend port changes
 */
export const updateBaseURL = async () => {
  if (window.electronAPI) {
    try {
      const response = await window.electronAPI.getBackendPort()
      if (response.success && response.data.baseURL) {
        api.defaults.baseURL = response.data.baseURL
        return response.data.baseURL
      }
    } catch (error) {
      console.error('Failed to update backend URL:', error)
    }
  }
  return api.defaults.baseURL
}

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
  importCSV: (formData) => api.post('/decks/import/csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
}

// Questions API
export const questionsAPI = {
  create: (data) => api.post('/questions/', data),
  get: (id) => api.get(`/questions/${id}`),
  getByDocument: (documentId) => api.get(`/questions/document/${documentId}`),
  delete: (id) => api.delete(`/questions/${id}`),
  suggestTags: (id) => api.get(`/questions/${id}/suggested-tags`),
}



// Progress API
export const progressAPI = {
  submit: (data) => api.post('/progress/submit', data),
  getQuestion: (questionId) => api.get(`/progress/question/${questionId}`),
  getStats: () => api.get('/progress/stats'),
  getStatsByNotebook: () => api.get('/progress/stats/by-notebook'),
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

// Activity: what you did, which day, and what it earned
export const activityAPI = {
  get: (days = 365) => api.get(`/activity/?days=${days}`),
  mood: () => api.get('/activity/mood'),
  awards: () => api.get('/activity/awards'),
}

// Notebooks: the topic a set of sources belongs to
export const notebooksAPI = {
  list: () => api.get('/notebooks/'),
  create: (body) => api.post('/notebooks/', body),
  get: (id) => api.get(`/notebooks/${id}`),
  update: (id, body) => api.patch(`/notebooks/${id}`, body),
  remove: (id) => api.delete(`/notebooks/${id}`),
}

// Canvas: diagrams drawn from a document
export const canvasAPI = {
  templates: () => api.get('/canvas/templates'),
  listAll: () => api.get('/canvas/'),
  generate: (documentId, requestText, template = null) =>
    api.post('/canvas/generate', {
      document_id: documentId,
      request_text: requestText,
      template,
    }),
  candidates: (jobId) => api.get(`/canvas/candidates/${jobId}`),
  get: (canvasId) => api.get(`/canvas/${canvasId}`),
  listForDocument: (documentId) => api.get(`/canvas/document/${documentId}`),
  update: (canvasId, body) => api.patch(`/canvas/${canvasId}`, body),
  nodeSource: (canvasId, nodeId) => api.get(`/canvas/${canvasId}/nodes/${nodeId}/source`),
  questionsForNode: (canvasId, nodeId, count = 3) =>
    api.post(`/canvas/${canvasId}/nodes/${nodeId}/questions?count=${count}`),
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
