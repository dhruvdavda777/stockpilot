// Thin fetch wrapper. All calls are relative (/api/...) so the same build works
// behind Vite's dev proxy, Nginx in Docker, and the Kubernetes Ingress.

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body, params } = {}) {
  const query = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    : ''
  let response
  try {
    response = await fetch(`/api${path}${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the StockPilot API', 0)
  }
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(errorMessage(data) || `Request failed (${response.status})`, response.status)
  }
  return data
}

function errorMessage(data) {
  if (!data?.detail) return null
  if (typeof data.detail === 'string') return data.detail
  // FastAPI validation errors: [{loc: [...], msg: '...'}]
  return data.detail.map((d) => `${d.loc?.at(-1) ?? 'field'}: ${d.msg}`).join('; ')
}

export const api = {
  stats: () => request('/stats'),
  products: (params) => request('/products', { params }),
  createProduct: (body) => request('/products', { method: 'POST', body }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PUT', body }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  adjustStock: (id, body) => request(`/products/${id}/adjust`, { method: 'POST', body }),
  movements: (params) => request('/movements', { params }),
  categories: () => request('/categories'),
  createCategory: (body) => request('/categories', { method: 'POST', body }),
  updateCategory: (id, body) => request(`/categories/${id}`, { method: 'PUT', body }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
}
