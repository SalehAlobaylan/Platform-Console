'use client';

import { useEffect, useState } from 'react';

/** Age displayed evidence without treating a browser tick as a new observation. */
export function useObservationClock(enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 1_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [enabled]);
  return now;
}
