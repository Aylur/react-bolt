import {
  computedDecorator,
  stateAccessorDecorator,
  stateFieldDecorator,
  type Field,
  type Getter,
  type Store,
} from "./store.js"

import {
  computed as computedPrimitive,
  state as statePrimitive,
  type Accessor,
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
export function state<T>(
  target: ClassAccessorDecoratorTarget<Store, T>,
  ctx: ClassAccessorDecoratorContext<Store, T>,
): ClassAccessorDecoratorResult<Store, T>
export function state<T>(init: T): State<T>
export function state<T>(
  init: T | undefined | ClassAccessorDecoratorTarget<Store, T>,
  ctx?:
    | ClassFieldDecoratorContext<Store, T>
    | ClassAccessorDecoratorContext<Store, T>,
): Field<T> | State<T> | ClassAccessorDecoratorResult<Store, T> {
  if (ctx && ctx.kind === "field") {
    return stateFieldDecorator(init as undefined, ctx)
  }
  if (ctx && ctx.kind === "accessor") {
    return stateAccessorDecorator(
      init as ClassAccessorDecoratorTarget<Store, T>,
      ctx,
    )
  }
  return statePrimitive(init as T)
}

export { createStoreHook, useComputed, useStore, useAccessor } from "./hooks.js"
export {
  effect,
  type Accessed,
  type Accessor,
  type Setter,
  type State,
} from "./state.js"
export { createStore } from "./store.js"
