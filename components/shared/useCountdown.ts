"use client";

import { useEffect, useState } from "react";

/**
 * Milliseconds left until `getRemaining()` reaches zero, re-read on a short interval so the
 * display is smooth without depending on network ticks.
 */
export function useRemaining(getRemaining: () => number, intervalMs = 100): number {
  const [ms, setMs] = useState(() => getRemaining());
  useEffect(() => {
    setMs(getRemaining());
    const id = setInterval(() => setMs(getRemaining()), intervalMs);
    return () => clearInterval(id);
  }, [getRemaining, intervalMs]);
  return ms;
}
