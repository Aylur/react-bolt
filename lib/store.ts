import { atom, computed as derived, track } from "./atom.js"

const priv = Symbol("priv")

export type Field<T> = (this: Store, init: T) => T
export type Getter<T> = (this: Store) => T
export type Store = { [key: string | symbol]: any }

type Key = string | symbol

function defineField(store: Store, key: Key) {
  Object.defineProperty(store, key, {
    configurable: true,
    enumerable: true,
    set(value: unknown) {
      return this[priv][key].set(value)
    },
    get() {
      return this[priv][key]()
    },
  })
}

export function field<T>(
  _: undefined,
  ctx: ClassFieldDecoratorContext<Store, T>,
): Field<T> {
  const key = ctx.name

  ctx.addInitializer(function () {
    delete this[key]
    defineField(this, key)
  })

  return function (init) {
    const internals = this[priv] ?? (this[priv] = {})
    internals[key] = atom(init)
    return void init as T
  }
}

export function computed<T>(
  compute: () => T,
  ctx: ClassGetterDecoratorContext<Store, T>,
): Getter<T> {
  const key = ctx.name

  ctx.addInitializer(function () {
    const internals = this[priv] ?? (this[priv] = {})
    internals[key] = derived(compute.bind(this))
  })

  return function () {
    return this[priv][key]()
  }
}

export function subscribe<S extends Store, Key extends keyof Store>(
  store: S,
  key: keyof S,
  fn: (value: S[Key]) => void,
) {
  const [value, accessors] = track(store[priv][key])
  fn(value as S[Key])
  const dispose = [...accessors].map((a) =>
    a.subscribe(() => {
      fn(store[priv][key]())
    }),
  )
  return () => dispose.map((fn) => fn())
}

/** @experimental */
export function createStore<S extends Store>(store: S): S {
  const obj = {}
  const properties = Object.entries(Object.getOwnPropertyDescriptors(store))

  for (const [key, desc] of properties) {
    if ("value" in desc) {
      const value = atom(desc.value)
      Object.defineProperty(obj, key, {
        get: value,
        set: value.set,
        enumerable: true,
      })
    } else if ("get" in desc) {
      Object.defineProperty(obj, key, {
        get: derived(desc.get!.bind(obj)),
        set: desc.set,
        enumerable: true,
      })
    } else {
      Object.defineProperty(obj, key, desc)
    }
  }

  return obj as S
}
