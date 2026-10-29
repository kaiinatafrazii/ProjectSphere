const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? `${window.location.origin}/api` : 'http://localhost:5000/api');
const configuredApiUrl = new URL(API_BASE_URL, window.location.origin);
if (import.meta.env.PROD && window.location.protocol === 'https:' && configuredApiUrl.protocol !== 'https:') {
  throw new Error('The ProjectSphere API must use HTTPS when the frontend is served over HTTPS.');
}

export async function apiRequest(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    if (
      response.status === 401 &&
      !path.startsWith('/auth/login') &&
      !path.startsWith('/auth/register') &&
      !path.startsWith('/auth/logout')
    ) {
      window.dispatchEvent(new CustomEvent('projectsphere:unauthorized'));
    }
    throw new Error(payload.message || 'Request failed.');
  }

  return payload;
}
