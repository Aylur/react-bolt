const priv = Symbol("store private")
const subscribers = Symbol("store subscribers")
const computedCache = Symbol("cached computed values")
const computedDispose = Symbol("computed dispose callbacks")

type Key = string | symbol

type DependencyMap = Map<Store, Set<Key>>
const dependencyStack = new Array<DependencyMap>()

function track(store: Store, key: Key) {
  const dependency = dependencyStack.at(-1)
  if (dependency) {
    const keys = dependency.get(store) ?? new Set()
    keys.add(key)
    dependency.set(store, keys)
  }
}

function push() {
  const dependencyMap: DependencyMap = new Map()
  dependencyStack.push(dependencyMap)
  return dependencyMap
}

export class Store {
  [priv]: Record<string | symbol, unknown> = {};
  [subscribers]: { [K in keyof this]?: Set<() => void> } = {};
  [computedCache] = new Map<Key, unknown>();
  [computedDispose] = new Map<Key, () => void>()
}

export function subscribe<S extends Store, K extends keyof S>(
  store: S,
  key: K,
  callback: () => void,
): () => void {
  const set = (store[subscribers][key] ??= new Set())
  set.add(callback)
  return () => void set.delete(callback)
}

export function notify<S extends Store, K extends keyof S>(store: S, key: K) {
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
      track(this, key)
      return this[priv][key]
    },
  } satisfies ThisType<Store>)
}

function defineComputed<T>(key: Key, compute: Getter<T>): Getter<T> {
  return function () {
    track(this, key)

    if (this[computedCache].has(key)) {
      return this[computedCache].get(key) as T
    }

    this[computedDispose]?.get(key)?.()

    const dependencyMap = push()
    const value = compute.call(this)

    const dispose = [...dependencyMap].flatMap(([store, dependencies]) =>
      [...dependencies].map((dep) =>
        subscribe(store, dep as keyof Store, () => {
          this[computedCache].delete(key)
          // if there is a subscription that immediately invokes a recomputation
          // which is very likely, this would result in an infinite loop, so we
          // need the timeout to escape order of execution
          setTimeout(() => notify(this, key as keyof Store))
        }),
      ),
    )

    this[computedDispose].set(key, () => dispose.forEach((cb) => cb()))
    this[computedCache].set(key, value)
    dependencyStack.pop()
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

export function selector<S extends Store, Result>(
  store: S,
  selector: (store: S) => Result,
) {
  const dependencyMap = push()
  const result = selector(store)
  dependencyStack.pop()

  return [dependencyMap, result] as const
}
