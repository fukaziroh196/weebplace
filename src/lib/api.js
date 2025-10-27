// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
// Derive API origin (e.g., http://host:port) to prefix relative resources like /uploads/...
let API_ORIGIN = '';
try {
  const u = new URL(API_URL, window?.location?.origin);
  // If API_URL ends with /api, strip it for origin prefix
  const origin = `${u.protocol}//${u.host}`;
  API_ORIGIN = origin;
} catch (_) {
  API_ORIGIN = '';
}

function toAbsoluteUploadUrl(maybePath) {
  try {
    const s = String(maybePath || '');
    if (s.startsWith('http://') || s.startsWith('https://') || !s.startsWith('/')) return s;
    // prefix relative server path like /uploads/...
    return API_ORIGIN ? `${API_ORIGIN}${s}` : s;
  } catch (_) { return maybePath; }
}

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
  async getAll(date) {
    const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
    const list = await apiRequest(`/anime-guesses${suffix}`);
    return (Array.isArray(list) ? list : []).map((g) => ({
      ...g,
      image: toAbsoluteUploadUrl(g.image),
    }));
  },

  async upload(file, title, animeId, sourceId, quizDate) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('title', title);
    formData.append('animeId', animeId);
    if (sourceId) formData.append('sourceId', sourceId);
    if (quizDate) formData.append('quizDate', quizDate);

    const created = await apiRequest('/anime-guesses', {
      method: 'POST',
      headers: {
        // Don't set Content-Type, let browser set it for FormData
        'Authorization': `Bearer ${getToken()}`,
      },
      body: formData,
    });
    // Normalize image field and prefix absolute
    if (created && !created.image && created.imageUrl) {
      created.image = created.imageUrl;
    }
    if (created && created.image) {
      created.image = toAbsoluteUploadUrl(created.image);
    }
    return created;
  },

  async dates() {
    return await apiRequest('/anime-guesses/dates');
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


