import {
  computed as computedDecorator,
  type Store,
  type Getter,
} from "./store.js"

import { Accessor, computed as computedPrimitive } from "./atom.js"

export function computed<T>(
  compute: () => T,
  ctx: ClassGetterDecoratorContext<Store, T>,
): Getter<T>

export function computed<T>(compute: () => T): Accessor<T>

export function computed<T>(
  compute: () => T,
  ctx?: ClassGetterDecoratorContext<Store, T>,
): Getter<T> {
  if (ctx) return computedDecorator(compute, ctx)
  return computedPrimitive(compute)
}

export {
  type Accessor,
  type Atom,
  atom,
  accessor,
  effect,
  untrack,
} from "./atom.js"
export { createStore, field, subscribe } from "./store.js"
export { useBolt, useStore, createStoreHook } from "./hooks.js"
