// api.js - central backend config + token helpers
// Change API_BASE to your production URL when you deploy.
const API_BASE = "https://ipa-can3.onrender.com/api";

// --- token storage ---
function saveAuth(data){
  localStorage.setItem("ipa_token", data.token);
  localStorage.setItem("ipa_name", data.name || "");
  localStorage.setItem("ipa_is_admin", data.is_admin ? "1" : "0");
}
function getToken(){ return localStorage.getItem("ipa_token"); }
function isAdmin(){ return localStorage.getItem("ipa_is_admin") === "1"; }
function getName(){ return localStorage.getItem("ipa_name") || ""; }
function clearAuth(){
  localStorage.removeItem("ipa_token");
  localStorage.removeItem("ipa_name");
  localStorage.removeItem("ipa_is_admin");
}

// --- fetch helper that attaches the token ---
async function apiFetch(path, options = {}){
  const headers = options.headers || {};
  if(!(options.body instanceof FormData)){
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if(token) headers["Authorization"] = "Token " + token;

  const res = await fetch(API_BASE + path, { ...options, headers });
  return res;
}