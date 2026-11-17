import { useEffect, useRef, type RefObject } from "react";

/**
 * Ref sempre allineato all'ultimo valore (oggetti three creati con useMemo e modificati nei fotogrammi):
 * i cicli di useFrame scrivono su `ref.current`, mai sul valore del render.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
