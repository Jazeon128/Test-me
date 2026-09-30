// The backend's error handler nests the reason under error.message. Plain
// FastAPI responses use detail. Settings calls axios directly, so read both.
export const serverMessage = (error) =>
  error.response?.data?.error?.message || error.response?.data?.detail
