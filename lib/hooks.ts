import { useCallback, useRef, useState, useSyncExternalStore } from "react"
import { type Store, subscribe, selector } from "./store.js"

export function useStore<S extends Store, K extends keyof S>(
  store: S,
  key: K,
): S[K]

export function useStore<S extends Store, Keys extends Array<keyof S>>(
  store: S,
  ...keys: Keys
): { [K in keyof Keys]: S[Keys[K]] }

export function useStore<S extends Store, Result>(
  store: S,
  selector: (store: S) => Result,
): Result

export function useStore<S extends Store>(
  store: S,
  arg: ((store: S) => unknown) | keyof S,
  ...args: Array<keyof S>
) {
  const [initial] = useState(() =>
    typeof arg === "function"
      ? arg(store)
      : args.length === 0
        ? store[arg]
        : [arg, ...args].map((key) => store[key]),
  )
  const value = useRef<unknown>(initial)

  const subscribeCallback = useCallback(
    (callback: () => void) => {
      // selector
      // TODO: don't assume the subscribe function is always a new ref:
      // cleanup previous dependencies and rerun the selector
      if (typeof arg === "function") {
        const [dependencyMap, result] = selector(store, arg)
        value.current = result

        const dispose = [...dependencyMap].flatMap(([dependency, keys]) =>
          [...keys].map((key) =>
            subscribe(dependency, key as keyof Store, () => {
              // this assumes that dependencies did not change
              // however passing a new subscribe function will
              // trigger a resubscription anyway
              const [, result] = selector(store, arg)
              value.current = result
              callback()
            }),
          ),
        )
        return () => dispose.forEach((cb) => cb())
      }

      // single key
      if (args.length === 0) {
        value.current = store[arg]
        return subscribe(store, arg, () => {
          value.current = store[arg]
          callback()
        })
      }

      // array of keys version
      const keys = [arg, ...args]
      value.current = keys.map((key) => store[key])
      const unsubs = keys.map((key) =>
        subscribe(store, key, () => {
          value.current = keys.map((key) => store[key])
          callback()
        }),
      )
      return () => unsubs.forEach((cb) => cb())
    },
    [store, arg, ...args],
  )

  const get = useCallback(() => value.current, [value])

  return useSyncExternalStore(subscribeCallback, get, get)
}

type StoreHook<S extends Store> = {
  <K extends keyof S>(key: K): S[K]

  <Keys extends Array<keyof S>>(
    ...keys: Keys
  ): { [K in keyof Keys]: S[Keys[K]] }

  <Result>(selector: (store: S) => Result): Result
}

export function createStoreHook<S extends Store>(store: S): StoreHook<S> {
  return (...args: any[]) => useStore(store, ...args)
}

/** @deprecated use {@link useStore} instead */
export const useStoreSelection = useStore
