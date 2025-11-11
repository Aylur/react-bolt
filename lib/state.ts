type DisposeFn = () => void
type CallbackFn = () => void
type SubscribeFn = (callback: CallbackFn) => DisposeFn

let effectScope = false
const nil = Symbol("nil")
const accessStack = new Array<Set<Accessor>>()

export interface Accessor<T = unknown> {
  /**
   * Track this as a dependency in a reactive scope.
   * @returns The current value
   */
  (): T
  /**
   * @returns Current value without tracking it as a dependency.
   */
  peek(): T
  /**
   * Subscribe for value changes.
   * @param callback The function to run when the current value changes.
   * @returns Unsubscribe function.
   */
  subscribe(callback: CallbackFn): DisposeFn
}

function createAccessor<T>(get: () => T, subscribe: SubscribeFn): Accessor<T> {
  let self: Accessor<T>

  function access(this: Accessor) {
    accessStack.at(-1)?.add(self)
    return get()
  }

  return (self = Object.assign(access, { peek: get, subscribe }))
}

export type Accessed<T> = T extends Accessor<infer V> ? V : never

export type Setter<T> = (value: T) => void // TODO: support updater fn

export type State<T> = [Accessor<T>, Setter<T>]

/**
 * Create a writable signal.
 * @param init The intial value of the signal
 * @returns An `Accessor` and a setter function
 */
export function state<T>(init: T): State<T> {
  let currentValue = init
  const observers = new Set<CallbackFn>()

  const subscribe: SubscribeFn = (callback) => {
    observers.add(callback)
    return () => observers.delete(callback)
  }

  const set: Setter<T> = (value) => {
    if (!Object.is(currentValue, value)) {
      currentValue = value
      Array.from(observers).forEach((cb) => cb())
    }
  }

  const get = (): T => {
    return currentValue
  }

  return [createAccessor(get, subscribe), set]
}

function track<T>(fn: () => T) {
  const deps = new Set<Accessor>()
  accessStack.push(deps)
  const res = fn()
  accessStack.pop()
  return [res, deps] as const
}

/**
 * Runs a function tracking the dependencies and reruns whenever they change.
 * @param fn The effect logic
 * @returns Dispose function to stop the effect
 */
export function effect(fn: CallbackFn): DisposeFn {
  let prevDeps = new Map<Accessor, DisposeFn>()

  function _effect() {
    effectScope = true
    const [, deps] = track(fn)
    const newDeps = new Map<Accessor, DisposeFn>()

    for (const [dep, dispose] of prevDeps) {
      if (!deps.has(dep)) {
        dispose()
      } else {
        newDeps.set(dep, dispose)
      }
    }

    for (const dep of deps) {
      if (!newDeps.has(dep)) {
        newDeps.set(dep, dep.subscribe(_effect))
      }
    }

    prevDeps = newDeps
    effectScope = false
  }

  _effect()

  return function dispose() {
    prevDeps.forEach((cb) => cb())
    prevDeps.clear()
  }
}

/**
 * Creates a computed value from a producer function which tracks
 * dependencies and invalidates tha value whenever they change.
 * The result is cached and is only computed on access.
 *
 * @param producer The computation logic
 * @returns `Accessor` to the value
 */
export function computed<T>(producer: () => T): Accessor<T> {
  let value: T | typeof nil = nil
  let prevDeps = new Map<Accessor, DisposeFn>()

  // in an effect scope we want to immediately track dependencies
  // and cache the result to avoid a recomputation after the effect scope
  let preValue: T | typeof nil = nil
  let preDeps = new Set<Accessor>()

  const observers = new Set<CallbackFn>()

  function invalidate() {
    value = nil
    Array.from(observers).forEach((cb) => cb())
  }

  function compute() {
    const [res, deps] = track(producer)
    const newDeps = new Map<Accessor, DisposeFn>()

    for (const [dep, dispose] of prevDeps) {
      if (!deps.has(dep)) {
        dispose()
      } else {
        newDeps.set(dep, dispose)
      }
    }

    for (const dep of deps) {
      if (!newDeps.has(dep)) {
        newDeps.set(dep, dep.subscribe(invalidate))
      }
    }

    prevDeps = newDeps
    return (value = res)
  }

  function subscribe(callback: CallbackFn): DisposeFn {
    if (observers.size === 0 && effectScope) {
      const prevDeps = new Map<Accessor, DisposeFn>()
      for (const dep of preDeps) {
        prevDeps.set(dep, dep.subscribe(invalidate))
      }
      value = preValue
      preDeps.clear()
      preValue = nil
    }

    observers.add(callback)

    return () => {
      observers.delete(callback)
      if (observers.size === 0) {
        prevDeps.forEach((cb) => cb())
        prevDeps.clear()
        value = nil
      }
    }
  }

  function get(): T {
    if (value !== nil) return value

    if (observers.size === 0) {
      if (effectScope) {
        const [res, deps] = track(producer)
        preDeps = deps
        preValue = res
        return res
      } else {
        return producer()
      }
    }

    return compute()
  }

  return createAccessor(get, subscribe)
}

// TODO:
// function debug(): DependencyGraph
