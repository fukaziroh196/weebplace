// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Get token from localStorage
function getToken() {
  return localStorage.getItem('api_token') || null;
}

// Set token in localStorage
function setToken(token) {
  if (token) {
    localStorage.setItem('api_token', token);
  } else {
    localStorage.removeItem('api_token');
  }
}

// Get auth headers (without forcing Content-Type)
function getAuthHeaders() {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// API wrapper
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = getAuthHeaders();

  try {
    // Auto-apply JSON Content-Type only when body is plain object/string, not FormData
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const finalHeaders = { ...headers, ...(options.headers || {}) };
    if (!isFormData && options.body != null && !('Content-Type' in finalHeaders)) {
      finalHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { ...options, headers: finalHeaders });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Auth API
export const auth = {
  async register(username, password) {
    const result = await apiRequest('/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (result.token) setToken(result.token);
    return result;
  },

  async login(username, password) {
    const result = await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (result.token) setToken(result.token);
    return result;
  },

  logout() {
    setToken(null);
  },

  async getMe() {
    return await apiRequest('/me');
  },
};

// Anime Guesses API
export const animeGuesses = {
  async getAll() {
    return await apiRequest('/anime-guesses');
  },

  async upload(file, title, animeId, sourceId) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('title', title);
    formData.append('animeId', animeId);
    if (sourceId) formData.append('sourceId', sourceId);

    return await apiRequest('/anime-guesses', {
      method: 'POST',
      headers: {
        // Don't set Content-Type, let browser set it for FormData
        'Authorization': `Bearer ${getToken()}`,
      },
      body: formData,
    });
  },

  async delete(id) {
    return await apiRequest(`/anime-guesses/${id}`, {
      method: 'DELETE',
    });
  },

  async checkAnswer(id, answer) {
    return await apiRequest(`/anime-guesses/${id}/check`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    });
  },
};

// Library API
export const library = {
  async save(dataType, data) {
    return await apiRequest('/library', {
      method: 'POST',
      body: JSON.stringify({ dataType, data }),
    });
  },

  async get(dataType) {
    const params = dataType ? `?type=${dataType}` : '';
    return await apiRequest(`/library${params}`);
  },
};

export { getToken, setToken };


