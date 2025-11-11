import { computed, state } from "./state.js"

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
      return this[priv][key][1](value)
    },
    get() {
      return this[priv][key][0]()
    },
  })
}

export function stateDecorator<T>(
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
    internals[key] = state(init)
    return void init as T
  }
}

export function computedDecorator<T>(
  compute: () => T,
  ctx: ClassGetterDecoratorContext<Store, T>,
): Getter<T> {
  const key = ctx.name

  ctx.addInitializer(function () {
    const internals = this[priv] ?? (this[priv] = {})
    internals[key] = computed(compute.bind(this))
  })

  return function () {
    return this[priv][key]()
  }
}

/** @experimental */
export function createStore<S extends Store>(store: S): S {
  const obj = {}
  const properties = Object.entries(Object.getOwnPropertyDescriptors(store))

  for (const [key, desc] of properties) {
    if ("value" in desc) {
      const [get, set] = state(desc.value)
      Object.defineProperty(obj, key, {
        get,
        set,
        enumerable: true,
      })
    } else if ("get" in desc) {
      Object.defineProperty(obj, key, {
        get: computed(desc.get!.bind(obj)),
        set: desc.set,
        enumerable: true,
      })
    } else {
      Object.defineProperty(obj, key, desc)
    }
  }

  return obj as S
}
