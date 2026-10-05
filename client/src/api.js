const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(options.headers || {});
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  const response = await fetch(url, {
    ...options,
    body,
    headers,
    credentials: "include",
  });
  let result;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  if (!response.ok || !result?.success) {
    const error = new ApiError(
      result?.message || "The request could not be completed.",
      response.status,
      result?.errors || [],
    );
    if (response.status === 401 && !path.endsWith("/auth/login"))
      window.dispatchEvent(new Event("attendance:session-expired"));
    throw error;
  }
  return result.data;
}

export const api = {
  get: (path, query) => {
    const suffix = query
      ? `?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== "" && value !== null)).toString()}`
      : "";
    return request(`${path}${suffix}`);
  },
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  upload: (path, file) => {
    const body = new FormData();
    body.append("photo", file);
    return request(path, { method: "POST", body });
  },
};

export function photoUrl(studentId) {
  return `${API_BASE}/students/${encodeURIComponent(studentId)}/photo`;
}
