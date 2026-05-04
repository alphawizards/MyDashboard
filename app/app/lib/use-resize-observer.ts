"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

type Size = {
  width: number;
  height: number;
};

const DEFAULT_SIZE: Size = { width: 0, height: 0 };

export function useResizeObserver<T extends Element>(): [RefObject<T | null>, Size] {
  const ref = useRef<T | null>(null);
  const frameRef = useRef<number | null>(null);
  const [size, setSize] = useState<Size>(DEFAULT_SIZE);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = requestAnimationFrame(() => {
        const box = entry.contentRect;
        setSize((current) => {
          const next = {
            width: Math.round(box.width),
            height: Math.round(box.height),
          };

          return current.width === next.width && current.height === next.height
            ? current
            : next;
        });
      });
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return [ref, size];
}
