type Listener = () => void;

let unauthorizedListener: Listener | null = null;

export function onUnauthorized(listener: Listener) {
  unauthorizedListener = listener;
  return () => {
    if (unauthorizedListener === listener) unauthorizedListener = null;
  };
}

export function notifyUnauthorized() {
  unauthorizedListener?.();
}
