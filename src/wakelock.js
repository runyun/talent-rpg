// Keep the screen on while timing (Screen Wake Lock; ignored where unsupported).

let lock = null;
let wanted = false;

async function request() {
  try {
    if (wanted && 'wakeLock' in navigator && !document.hidden) lock = await navigator.wakeLock.request('screen');
  } catch {
    lock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && wanted) request();
});

export function keepAwake() {
  wanted = true;
  request();
}

export function releaseAwake() {
  wanted = false;
  try {
    if (lock) lock.release();
  } catch {
    // ignore
  }
  lock = null;
}
