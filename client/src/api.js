async function request(method, url, body) {
  const res = await fetch(`/api${url}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = new Error((data && data.error) || `Error ${res.status}`);
    if (data && data.code) err.code = data.code;
    if (data && data.status) err.status = data.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (url) => request("GET", url),
  post: (url, body) => request("POST", url, body || {}),
  put: (url, body) => request("PUT", url, body || {}),
  patch: (url, body) => request("PATCH", url, body || {}),
  delete: (url) => request("DELETE", url),
};

export function downloadExport(projectId, params) {
  const query = new URLSearchParams(params).toString();
  const url = `/api/projects/${projectId}/export?${query}`;
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
