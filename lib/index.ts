import {
  computedDecorator,
  stateDecorator,
  type Store,
  type Getter,
  type Field,
} from "./store.js"

import {
  type Accessor,
  computed as computedPrimitive,
  state as statePrimitive,
  type State,
} from "./state.js"

export function computed<T>(produce: () => T): Accessor<T>
export function computed<T>(
  compute: () => T,
  ctx: ClassGetterDecoratorContext<Store, T>,
): Getter<T>
export function computed<T>(
  compute: () => T,
  ctx?: ClassGetterDecoratorContext<Store, T>,
): Getter<T> {
  if (ctx) return computedDecorator(compute, ctx)
  return computedPrimitive(compute)
}

export function state<T>(
  _: undefined,
  ctx: ClassFieldDecoratorContext<Store, T>,
): Field<T>
export function state<T>(init: T): State<T>
export function state<T>(
  init: T | undefined,
  ctx?: ClassFieldDecoratorContext<Store, T>,
): Field<T> | State<T> {
  if (ctx) return stateDecorator(init as undefined, ctx)
  return statePrimitive(init as T)
}

export {
  type Accessor,
  type State,
  type Setter,
  type Accessed,
  effect,
} from "./state.js"
export { createStore } from "./store.js"
export { useComputed, useStore, createStoreHook } from "./hooks.js"
