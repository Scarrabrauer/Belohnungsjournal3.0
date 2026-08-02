// GitHub-Contents-API als einfacher "Cloud-Speicher": eine JSON-Datei im eigenen Repo.
// Läuft komplett vom Browser aus, kein eigener Server nötig.

const CONFIG_KEY = "bj_sync_config_v1";

export function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : defaultConfig();
  } catch {
    return defaultConfig();
  }
}

function defaultConfig() {
  return {
    token: "",
    owner: "Scarrabrauer",
    repo: "Belohnungsjournal3.0",
    branch: "main",
    path: "data/entries.json",
    lastSyncedAt: "",
  };
}

export function saveSyncConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function apiUrl(config) {
  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function githubRequest(url, config, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  return res;
}

export async function fetchRemoteFile(config) {
  const url = `${apiUrl(config)}?ref=${encodeURIComponent(config.branch)}`;
  const res = await githubRequest(url, config);
  if (res.status === 404) return { entries: [], sha: null };
  if (!res.ok) throw new Error(`GitHub-Abruf fehlgeschlagen (${res.status}): ${await res.text()}`);
  const json = await res.json();
  const content = base64ToUtf8(json.content);
  let entries = [];
  try {
    entries = JSON.parse(content);
  } catch {
    entries = [];
  }
  return { entries: Array.isArray(entries) ? entries : [], sha: json.sha };
}

export async function putRemoteFile(config, entries, sha, message) {
  const body = {
    message: message || `Sync: ${entries.length} Einträge (${new Date().toISOString()})`,
    content: utf8ToBase64(JSON.stringify(entries, null, 2)),
    branch: config.branch,
  };
  if (sha) body.sha = sha;
  const res = await githubRequest(apiUrl(config), config, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub-Speichern fehlgeschlagen (${res.status}): ${await res.text()}`);
  return res.json();
}

export function isConfigured(config) {
  return Boolean(config.token && config.owner && config.repo && config.branch && config.path);
}

export async function testConnection(config) {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}`;
  const res = await githubRequest(url, config);
  if (!res.ok) throw new Error(`Repo nicht erreichbar (${res.status}). Token/Owner/Repo prüfen.`);
  return res.json();
}
