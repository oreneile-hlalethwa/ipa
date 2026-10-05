// frontend/config.js - the single place to switch backend URLs.
// Load this BEFORE api.js on every page.

const LOCAL_URL = "http://127.0.0.1:8000";
const PRODUCTION_URL = "https://ipa-can3.onrender.com";

// Picks local automatically when the page is opened from your machine
// (Live Server on 127.0.0.1:5500 or localhost), otherwise production.
const IS_LOCAL = ["127.0.0.1", "localhost"].includes(window.location.hostname);

const BASE_URL = IS_LOCAL ? LOCAL_URL : PRODUCTION_URL;