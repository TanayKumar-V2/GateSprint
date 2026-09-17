"use client";

import type { MotionValue } from "motion/react";
import { useCallback, useState, useSyncExternalStore } from "react";

/**
 * Returns true once a mount-progress MotionValue reaches 1.
 * Use to swap animated MotionValue-driven props for static values after
 * enter completes — drops per-frame subscriptions during pan/hover.
 */
export function useEnterComplete(mountProgress: MotionValue<number>): boolean {
  const subscribe = useCallback(
    (notify: () => void) => mountProgress.on("change", notify),
    [mountProgress]
  );
  const getSnapshot = useCallback(
    () => mountProgress.get() >= 1,
    [mountProgress]
  );
  const reachedEnd = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [complete, setComplete] = useState(reachedEnd);

  if (reachedEnd && !complete) {
    setComplete(true);
  }

  return complete || reachedEnd;
}
