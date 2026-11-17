const SAVE_KEY = 'heradetale.save.v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || save.version !== 1 || !Number.isFinite(save.x) || !Number.isFinite(save.y)) return null;
    return save;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, ...data, updatedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage may be unavailable */ }
}