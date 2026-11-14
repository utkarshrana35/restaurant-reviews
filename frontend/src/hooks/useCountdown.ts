import { useEffect, useState } from 'react';

/** Whole seconds remaining until `target` (a timestamp in ms), re-rendering once a second. */
export function useCountdown(target: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target]);

  return Math.max(0, Math.ceil((target - now) / 1000));
}
