const priv = Symbol("store private")
const subscribers = Symbol("store subscribers")
const evaluating = Symbol("evaluating fields")
const computedCache = Symbol("cached computed values")
const computedDispose = Symbol("computed dispose callbacks")

type Key = string | symbol

export class Store {
  [priv]: Record<string | symbol, unknown> = {};
  [subscribers]: { [K in keyof this]?: Set<() => void> } = {};
  [evaluating] = new Array<Set<Key>>();
  [computedCache] = new Map<Key, unknown>();
  [computedDispose] = new Map<Key, () => void>()
}

export function subscribe<S extends Store, K extends keyof S>(
  store: S,
  key: K,
  callback: () => void,
) {
  const set = (store[subscribers][key] ??= new Set())
  set.add(callback)
  return () => void set.delete(callback)
}

function notify<S extends Store, K extends keyof S>(store: S, key: K) {
  store[subscribers][key]?.forEach((cb) => cb())
}

type Field<T> = (this: Store, init: T) => T
type Getter<T> = (this: Store) => T

function defineField(store: Store, key: Key) {
  return Object.defineProperty(store, key, {
    configurable: true,
    enumerable: true,
    set(value: unknown) {
      if (this[priv][key] !== value) {
        this[priv][key] = value
        notify(this, key as keyof Store)
      }
    },
    get() {
      this[evaluating].at(-1)?.add(key)
      return this[priv][key]
    },
  } satisfies ThisType<Store>)
}

function defineComputed<T>(key: Key, compute: Getter<T>): Getter<T> {
  return function () {
    this[evaluating].at(-1)?.add(key)

    if (this[computedCache].has(key)) {
      return this[computedCache].get(key) as T
    }

    this[computedDispose]?.get(key)?.()

    const deps = new Set<Key>()
    this[evaluating].push(deps)
    const value = compute.call(this)

    const dispose = [...deps.values()].map((dep) =>
      subscribe(this, dep as keyof Store, () => {
        this[computedCache].delete(key)
        setTimeout(() => notify(this, key as keyof Store))
      }),
    )

    this[computedDispose].set(key, () => dispose.forEach((cb) => cb()))
    this[computedCache].set(key, value)
    this[evaluating].pop()
    return value
  }
}

export function field<T>(
  _: undefined,
  ctx: ClassFieldDecoratorContext<Store, T>,
): Field<T> {
  const key = ctx.name as keyof Store

  ctx.addInitializer(function () {
    delete this[key]
    defineField(this, key)
  })

  return function (init) {
    this[priv][key] = init
    return void init as T
  }
}

export function computed<T>(
  compute: () => T,
  ctx: ClassGetterDecoratorContext<Store, T>,
): Getter<T> {
  const key = ctx.name as keyof Store
  return defineComputed(key, compute)
}

export function fieldLegacy(proto: Store, key: Key) {
  defineField(proto, key)
}

export function computedLegacy<T>(
  _: Store,
  key: Key,
  desc: TypedPropertyDescriptor<T>,
) {
  const compute = desc.get as Getter<T>
  desc.get = defineComputed(key, compute)
}
