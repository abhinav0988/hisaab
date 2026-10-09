import { useRef } from "react";

/** Ignores a second tap before React re-renders the pending label. */
export function useSingleFlight() {
  const state = useRef({ locked: false });
  const api = useRef({
    run(pending: boolean, action: () => void) {
      if (state.current.locked || pending) return;
      state.current.locked = true;
      action();
    },
    end() {
      state.current.locked = false;
    },
  });
  return api.current;
}
