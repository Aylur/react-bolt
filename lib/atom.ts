type DisposeFn = () => void
type CallbackFn = () => void
type SubscribeFn = (callback: CallbackFn) => DisposeFn

const nil = Symbol("nil")
const accessStack = new Array<Set<AccessorPriv>>()

interface AccessorPriv<T = unknown> {
  get(): T
  subscribe: SubscribeFn
}

export interface Accessor<T = unknown> {
  (): T
}

function access<T>(this: AccessorPriv<T>): T {
  accessStack.at(-1)?.add(this)
  return this.get()
}

export function accessor<T>(get: () => T, subscribe: SubscribeFn): Accessor<T> {
  const self: AccessorPriv<T> = {
    get,
    subscribe,
  }

  return access.bind(self) as Accessor<T>
}

export interface Atom<T = unknown> extends Accessor<T> {
  readonly set: (value: T) => void
}

export function atom<T>(initial: T): Atom<T> {
  let currentValue = initial
  const observers = new Set<CallbackFn>()

  return Object.assign(
    accessor(
      () => currentValue,
      (callback) => {
        observers.add(callback)
        return () => observers.delete(callback)
      },
    ),
    {
      set: (value: T) => {
        if (!Object.is(currentValue, value)) {
          currentValue = value
          for (const callback of Array.from(observers)) {
            callback()
          }
        }
      },
    },
  )
}

export function effect(fn: CallbackFn): DisposeFn {
  let prevDeps = new Map<AccessorPriv, DisposeFn>()

  function _effect() {
    const deps = new Set<AccessorPriv>()
    accessStack.push(deps)
    fn()
    accessStack.pop()

    const newDeps = new Map<AccessorPriv, DisposeFn>()

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
  }

  _effect()

  return () => {
    for (const [, dispose] of prevDeps) {
      dispose()
    }
  }
}

export function computed<T>(compute: () => T): Accessor<T> {
  let value: T | typeof nil = nil
  let dispose: DisposeFn

  const observers = new Set<CallbackFn>()

  function subscribe(callback: CallbackFn): DisposeFn {
    if (observers.size === 0) {
      dispose = effect(() => {
        const newValue = compute()
        if (Object.is(value, newValue)) {
          value = newValue
          for (const callback of Array.from(observers)) {
            callback()
          }
        }
      })
    }

    observers.add(callback)

    return () => {
      observers.delete(callback)
      if (observers.size === 0) {
        value = nil
        dispose()
      }
    }
  }

  function get(): T {
    return value === nil ? compute() : value
  }

  return accessor(get, subscribe)
}

/** @internal */
export function track<T>(fn: () => T) {
  const set = new Set<AccessorPriv>()
  accessStack.push(set)
  const res = fn()
  accessStack.pop()
  return [res, set] as const
}

export function untrack<T>(fn: () => T) {
  const [res] = track(fn)
  return res
}
