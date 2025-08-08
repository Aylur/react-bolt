import { useCallback, useRef, useSyncExternalStore } from "react"
import { type Store, subscribe } from "./store"

export function useStore<S extends Store, K extends keyof S>(
  store: S,
  key: K,
): S[K] {
  const subscribeCallback = useCallback(
    (callback: () => void) => subscribe(store, key, callback),
    [key, store],
  )

  const get = useCallback(() => store[key], [key, store])

  return useSyncExternalStore(subscribeCallback, get, get)
}

export function useStoreSelection<S extends Store, Keys extends Array<keyof S>>(
  store: S,
  ...keys: Keys
): { [K in keyof Keys]: S[Keys[K]] } {
  const array = useRef(keys.map((key) => store[key]))

  const subscribeCallback = useCallback(
    (callback: () => void) => {
      const unsubs = keys.map((key) =>
        subscribe(store, key, () => {
          array.current = keys.map((key) => store[key])
          callback()
        }),
      )
      return () => unsubs.forEach((cb) => cb())
    },
    [keys, store],
  )

  const get = useCallback(
    () => array.current as { [K in keyof Keys]: S[Keys[K]] },
    [array],
  )

  return useSyncExternalStore(subscribeCallback, get, get)
}
