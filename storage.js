/* storage.js
   Simple localStorage helpers with versioning and safe parse fallback.
   Exposes window.Storage.loadState(defaultState, expectedVersion)
           window.Storage.saveState(state, version)
*/

(function (window) {
  const KEY = 'flashcards:state';
  const DEFAULT_VERSION = 1;

  // Safely parse JSON, return null on failure
  function safeParse(json) {
    try {
      return JSON.parse(json);
    } catch (err) {
      console.warn('Storage: failed to parse JSON', err);
      return null;
    }
  }

  // Loads state from localStorage. If missing or broken, returns defaultState.
  // Supports versioned payload: { version: number, data: <state> }
  function loadState(defaultState = { decks: [] }, expectedVersion = DEFAULT_VERSION) {
    if (typeof localStorage === 'undefined') return defaultState;

    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState;

    const parsed = safeParse(raw);
    if (!parsed) return defaultState;

    // If object contains version + data
    if (typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
      const { version, data } = parsed;
      if (version === expectedVersion) {
        return data != null ? data : defaultState;
      }

      // Version mismatch: best-effort fallback
      console.warn(`Storage: data version mismatch (found ${version}, expected ${expectedVersion})`);
      // If data exists, return it (app can decide how to migrate); otherwise fall back
      return data != null ? data : defaultState;
    }

    // If value itself is the raw state (older format), accept it
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }

    return defaultState;
  }

  // Save state with explicit version
  function saveState(state, version = DEFAULT_VERSION) {
    if (typeof localStorage === 'undefined') return false;
    try {
      const payload = JSON.stringify({ version, data: state });
      localStorage.setItem(KEY, payload);
      return true;
    } catch (err) {
      console.error('Storage: could not save state', err);
      return false;
    }
  }

  // Optional: clear stored state
  function clearState() {
    try {
      localStorage.removeItem(KEY);
      return true;
    } catch (err) {
      console.error('Storage: could not clear state', err);
      return false;
    }
  }

  window.Storage = {
    loadState,
    saveState,
    clearState,
    _KEY: KEY
  };
})(window);