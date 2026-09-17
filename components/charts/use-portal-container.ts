"use client";

import { type RefObject, useLayoutEffect, useState } from "react";

export function usePortalContainer<T extends HTMLElement>(
  containerRef: RefObject<T | null>
): T | null {
  const [container, setContainer] = useState<T | null>(null);

  useLayoutEffect(() => {
    setContainer(containerRef.current);
  }, [containerRef]);

  return container;
}
