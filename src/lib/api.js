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

// Stats API
export const stats = {
  async me() {
    return await apiRequest('/stats/me');
  }
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

  async uploadBatch(zipFile, quizDate) {
    const formData = new FormData();
    formData.append('archive', zipFile);
    if (quizDate) formData.append('quizDate', quizDate);
    const result = await apiRequest('/anime-guesses/batch', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData,
    });
    // normalize images
    if (result && Array.isArray(result.items)) {
      result.items = result.items.map((it) => ({ ...it, image: toAbsoluteUploadUrl(it.imageUrl || it.image) }));
    }
    return result;
  },

  async uploadPack(slots, quizDate) {
    // slots: [{ file, title, hint } x4]
    if (!Array.isArray(slots) || slots.length !== 4) {
      throw new Error('Exactly 4 slots required');
    }
    if (!quizDate || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(quizDate)) {
      throw new Error('Valid quizDate (YYYY-MM-DD) required');
    }
    
    const formData = new FormData();
    formData.append('quizDate', quizDate);
    
    for (let i = 0; i < 4; i++) {
      const slot = slots[i];
      if (!slot.file) {
        throw new Error(`Missing file for slot ${i + 1}`);
      }
      if (!slot.title || !slot.title.trim()) {
        throw new Error(`Missing title for slot ${i + 1}`);
      }
      formData.append(`image${i + 1}`, slot.file);
      formData.append(`title${i + 1}`, slot.title.trim());
      if (slot.hint && slot.hint.trim()) {
        formData.append(`hint${i + 1}`, slot.hint.trim());
      }
    }

    console.log(`[uploadPack] Uploading pack for ${quizDate}...`);
    
    try {
      const url = `${API_URL}/packs`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
          // Don't set Content-Type - browser will set it with boundary for FormData
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[uploadPack] Success:', result);
      
      // Normalize image URLs
      if (result && Array.isArray(result.items)) {
        result.items = result.items.map((it) => ({ 
          ...it, 
          image: toAbsoluteUploadUrl(it.imageUrl || it.image) 
        }));
      }
      
      return result;
    } catch (error) {
      console.error('[uploadPack] Error:', error);
      throw error;
    }
  },

  async validateBatch(zipFile) {
    const formData = new FormData();
    formData.append('archive', zipFile);
    return await apiRequest('/anime-guesses/batch/validate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData,
    });
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

// Leaderboard API
export const leaderboard = {
  async list(limit = 50, period = 'all', date) {
    const params = new URLSearchParams({ limit: String(limit), period });
    if (date) params.set('date', date);
    return await apiRequest(`/leaderboard?${params.toString()}`);
  }
};

export function getBatchSampleZipUrl(date) {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return `${API_URL}/anime-guesses/batch/sample${q}`;
}

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


