// js/api.js — Centralised API client
const API_BASE = ""; // same origin (Node.js serves frontend)

const api = {
  _token: () => localStorage.getItem("token"),

  _headers() {
    const h = { "Content-Type": "application/json" };
    const t = this._token();
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
  },

  async _fetch(method, path, body) {
    const opts = { method, headers: this._headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw Object.assign(new Error(data.error || "Request failed"), {
        status: res.status,
        data,
      });
    return data;
  },

  // Auth
  register: (body) => api._fetch("POST", "/api/auth/register", body),
  login: (body) => api._fetch("POST", "/api/auth/login", body),
  me: () => api._fetch("GET", "/api/auth/me"),

  // Carbon
  calculateEmission: (body) =>
    api._fetch("POST", "/api/carbon/emission/calculate", body),
  dashboardSummary: (params) => {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v),
    );
    return api._fetch(
      "GET",
      "/api/carbon/dashboard/summary?" + new URLSearchParams(filtered),
    );
  },
  dashboardRegion: (params) =>
    api._fetch(
      "GET",
      "/api/carbon/dashboard/region?" + new URLSearchParams(params),
    ),
  marketplace: (params) =>
    api._fetch("GET", "/api/carbon/marketplace?" + new URLSearchParams(params)),
  trade: (body) => api._fetch("POST", "/api/carbon/trade", body),

  // Seller
  registerSellerProject: (body) =>
    api._fetch("POST", "/api/seller/project", body),
  myProjects: () => api._fetch("GET", "/api/seller/projects"),
};

// Toast notification utility
function showToast(message, type = "success") {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3500);
}

// Auth guard
function requireAuth() {
  if (!localStorage.getItem("token")) {
    window.location.href =
      "/login?redirect=" + encodeURIComponent(location.pathname);
    return false;
  }
  return true;
}

function logout() {
  localStorage.clear();
  window.location.href = "/login";
}
