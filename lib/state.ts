type Fn = () => void
type SubscribeFn = (callback: Fn) => Fn
type EqualsFn<T> = (prev: T, next: T) => boolean

export type Accessed<T> = T extends Accessor<infer V> ? V : never

export type Setter<T> = (value: T) => void
export type State<T> = [Accessor<T>, Setter<T>]

export type StateOptions<T> = {
  equals?: EqualsFn<T>
}

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
  subscribe(callback: Fn): Fn
}

let EffectDepth = 0

const NIL = Symbol("nil")
const AccessStack = new Array<Set<Accessor>>()

function run<T>(fn: () => T) {
  const deps = new Set<Accessor>()
  AccessStack.push(deps)
  const res = fn()
  AccessStack.pop()
  return [res, deps] as const
}

function diff(prev: Map<Accessor, Fn>, next: Set<Accessor>, fn: Fn) {
  const newDeps = new Map<Accessor, Fn>()

  for (const [dep, dispose] of prev) {
    if (!next.has(dep)) {
      dispose()
    } else {
      newDeps.set(dep, dispose)
    }
  }

  for (const dep of next) {
    if (!newDeps.has(dep)) {
      newDeps.set(dep, dep.subscribe(fn))
    }
  }

  return newDeps
}

function createAccessor<T>(get: () => T, subscribe: SubscribeFn): Accessor<T> {
  let self: Accessor<T>

  function access(this: Accessor) {
    AccessStack.at(-1)?.add(self)
    return get()
  }

  return (self = Object.assign(access, { peek: get, subscribe }))
}

/**
 * Create a writable signal.
 * @param init The intial value of the signal
 * @returns An `Accessor` and a setter function
 */
export function createState<T>(init: T, options?: StateOptions<T>): State<T> {
  let value = init

  const observers = new Set<Fn>()
  const equals = options?.equals ?? Object.is

  const subscribe: SubscribeFn = (callback) => {
    observers.add(callback)
    return () => observers.delete(callback)
  }

  const set: Setter<T> = (newValue) => {
    if (!equals(value, newValue)) {
      value = newValue
      Array.from(observers).forEach((cb) => cb())
    }
  }

  const get = (): T => {
    return value
  }

  return [createAccessor(get, subscribe), set]
}

/**
 * Runs a function tracking the dependencies and reruns whenever they change.
 * @param fn The effect logic
 * @returns Dispose function to stop the effect
 */
export function effect<T = void>(fn: (prev?: T) => T): Fn {
  let value: T
  let deps = new Map<Accessor, Fn>()

  function syncEffect() {
    EffectDepth++
    const [res, nextDeps] = run(() => fn(value))
    deps = diff(deps, nextDeps, syncEffect)
    value = res
    EffectDepth--
  }

  syncEffect()

  return function dispose() {
    deps.forEach((cb) => cb())
    deps.clear()
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
export function createComputed<T>(producer: () => T): Accessor<T> {
  let value: T | typeof NIL = NIL
  let deps = new Map<Accessor, Fn>()

  const observers = new Set<Fn>()

  // in an effect scope we want to immediately track dependencies
  // and cache the result to avoid a recomputation after the effect scope
  let preValue: T | typeof NIL = NIL
  let preDeps = new Set<Accessor>()

  function invalidate() {
    value = NIL
    Array.from(observers).forEach((cb) => cb())
  }

  function computeEffect() {
    const [res, nextDeps] = run(producer)
    deps = diff(deps, nextDeps, computeEffect)
    return (value = res)
  }

  function subscribe(callback: Fn): Fn {
    if (observers.size === 0) {
      if (EffectDepth) {
        value = preValue
        deps = new Map(
          [...preDeps].map((dep) => [dep, dep.subscribe(invalidate)]),
        )
        preDeps.clear()
        preValue = NIL
      } else {
        computeEffect()
      }
    }

    observers.add(callback)

    return () => {
      observers.delete(callback)
      if (observers.size === 0) {
        deps.forEach((cb) => cb())
        deps.clear()
        value = NIL
      }
    }
  }

  function get(): T {
    if (value !== NIL) return value

    if (observers.size === 0) {
      if (EffectDepth) {
        const [res, deps] = run(producer)
        preDeps = deps
        preValue = res
        return res
      } else {
        return producer()
      }
    }

    // outside an effect doing .subscribe(() => .peek())
    // will trigger the effect here on first access
    return computeEffect()
  }

  return createAccessor(get, subscribe)
}
