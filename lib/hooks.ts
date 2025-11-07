import { useCallback, useRef, useSyncExternalStore } from "react"
import { effect } from "./atom"

export function useBolt<T>(fn: () => T) {
  const value = useRef<T>(fn())
  const get = useCallback(() => value.current, [fn, value])
  return useSyncExternalStore(
    useCallback(
      (callback) =>
        effect(() => {
          const newValue = fn()
          if (!Object.is(newValue, value.current)) {
            value.current = newValue
            callback()
          }
        }),
      [fn],
    ),
    get,
    get,
  )
}

export function useStore<S extends object, K extends keyof S>(
  store: S,
  key: K,
): S[K]

export function useStore<S extends object, Keys extends Array<keyof S>>(
  store: S,
  ...keys: Keys
): { [K in keyof Keys]: S[Keys[K]] }

export function useStore<S extends object, Result>(
  store: S,
  selector: (store: S) => Result,
): Result

export function useStore<S extends object>(
  store: S,
  arg: ((store: S) => unknown) | keyof S,
  ...args: Array<keyof S>
) {
  return useBolt(
    useCallback(() => {
      if (typeof arg === "function") {
        return arg(store)
      }

      if (args.length === 0) {
        return store[arg]
      }

      return [arg, ...args].map((key) => store[key])
    }, [store, arg, ...args]),
  )
}

type StoreHook<S extends object> = {
  <K extends keyof S>(key: K): S[K]

  <Keys extends Array<keyof S>>(
    ...keys: Keys
  ): { [K in keyof Keys]: S[Keys[K]] }

  <Result>(selector: (store: S) => Result): Result
}

export function createStoreHook<S extends object>(store: S): StoreHook<S> {
  return (...args: any[]) => useStore(store, ...args)
}
