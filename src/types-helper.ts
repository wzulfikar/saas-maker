// Helpers for type checking
export type Expect<T extends true> = T

export type Eq<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  T,
>() => T extends Y ? 1 : 2
  ? true
  : false

export type Neq<X, Y> = true extends Eq<X, Y> ? false : true

// Helpers for debugging, DX
export type Pretty<T> = {
  [K in keyof T]: T[K]
}
