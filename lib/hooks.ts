import { useCallback, useRef, useState, useSyncExternalStore } from "react"
import { Accessor, effect } from "./state"

export function useAccessor<T>(accessor: Accessor<T>): T {
  return useSyncExternalStore(accessor.subscribe, accessor.peek, accessor.peek)
}

type UseComputedArgs<T> =
  | (() => T)
  | {
      fn(): T
      equals(prev: T, next: T): boolean
    }

export function useComputed<T>(args: UseComputedArgs<T>): T {
  const fn = typeof args === "function" ? args : args.fn
  const equals = typeof args === "object" ? args.equals : Object.is

  const [init] = useState(fn)
  const value = useRef<T>(init)
  const get = useCallback(() => value.current, [value])

  return useSyncExternalStore(
    useCallback(
      (callback) =>
        effect(() => {
          const newValue = fn()
          if (!equals(newValue, value.current)) {
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

export function useStore<S extends object>(
  store: S,
  arg: keyof S,
  ...args: Array<keyof S>
) {
  return useComputed(
    useCallback(() => {
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
}

export function createStoreHook<S extends object>(store: S): StoreHook<S> {
  return (...args: any[]) => useStore(store, ...args)
}
