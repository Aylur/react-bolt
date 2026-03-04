import { type State, createComputed, createState } from "./state.js"

const priv = Symbol("priv")

export type Getter<T> = (this: Store) => T
export type Store = { [key: string | symbol]: any }

/**
 * Wraps a class property accessor with {@link createState}
 *
 * @example
 *
 * ```
 * class MyStore {
 *   \@state accessor n = 0
 * }
 * ```
 */
export function state<T>(
  target: ClassAccessorDecoratorTarget<Store, T>,
  _: ClassAccessorDecoratorContext<Store, T>,
): ClassAccessorDecoratorResult<Store, T> {
  const { get } = target as ClassAccessorDecoratorTarget<Store, State<T>>
  return {
    get() {
      return get.call(this)[0]()
    },
    set(value) {
      get.call(this)[1](value)
    },
    init(value) {
      return createState(value) as T
    },
  }
}

/**
 * Wraps a class getter with {@link createComputed}
 *
 * @example
 *
 * ```
 * class MyStore {
 *   \@computed get value() {
 *     return this.anyReactiveField
 *   }
 * }
 * ```
 */
export function computed<T>(
  compute: () => T,
  ctx: ClassGetterDecoratorContext<Store, T>,
): Getter<T> {
  const key = ctx.name

  ctx.addInitializer(function () {
    const internals = this[priv] ?? (this[priv] = {})
    internals[key] = createComputed(compute.bind(this))
  })

  return function () {
    return this[priv][key]()
  }
}

/**
 * Creates a singleton store where fields are replaces with reactive accessors.
 *
 * @example
 *
 * ```
 * const myStore = createStore({
 *   value: 0,
 *   get double() {
 *     return this.value * 2
 *   },
 *   nestedStore: createStore({
 *     value: "",
 *   }),
 * })
 * ```
 *
 * @experimental
 */
export function createStore<S extends Store>(store: S): S {
  const obj = {}
  const properties = Object.entries(Object.getOwnPropertyDescriptors(store))

  for (const [key, desc] of properties) {
    if ("value" in desc) {
      const [get, set] = createState(desc.value)
      Object.defineProperty(obj, key, {
        get,
        set,
        enumerable: true,
      })
    } else if ("get" in desc) {
      Object.defineProperty(obj, key, {
        get: createComputed(desc.get!.bind(obj)),
        set: desc.set,
        enumerable: true,
      })
    } else {
      Object.defineProperty(obj, key, desc)
    }
  }

  return obj as S
}
