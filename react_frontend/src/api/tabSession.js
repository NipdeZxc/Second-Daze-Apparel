const STORAGE_KEY = "sd_session_tab";
let sessionIdPromise;

export function getTabSessionId() {
  if (!sessionIdPromise) sessionIdPromise = claimTabSession();
  return sessionIdPromise;
}

async function claimTabSession() {
  if (!globalThis.navigator?.locks || !globalThis.crypto?.randomUUID) {
    throw new Error("This browser cannot isolate tab logins. Use an updated browser over HTTPS.");
  }
  const storage = window.sessionStorage;
  const savedId = storage.getItem(STORAGE_KEY);
  if (savedId !== null && !/^[a-f0-9]{32}$/.test(savedId)) {
    throw new Error("Invalid tab session data. Close this tab and open the website in a new tab.");
  }
  const newId = () => crypto.randomUUID().replaceAll("-", "");
  return new Promise((resolve, reject) => {
    const claim = (id) => {
      navigator.locks.request(`second-daze-session-${id}`, { ifAvailable: true }, (lock) => {
        if (!lock) {
          claim(newId());
          return;
        }
        storage.setItem(STORAGE_KEY, id);
        resolve(id);
        // Hold ownership until this document is destroyed so copied tab storage cannot share its login.
        return new Promise(() => {});
      }).catch(reject);
    };
    claim(savedId || newId());
  });
}
