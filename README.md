# React Bolt

Yet another client side state management library

```tsx
import { state, computed, useStore } from "react-bolt"

class MyStore {
  @state count = 1

  @computed get double() {
    return this.count * 2
  }

  readonly increment = () => {
    this.count++
  }
}

const myStore = new MyStore()

function App() {
  const count = useStore(myStore, "count")
  const double = useStore(myStore, "double")

  // or in one hook
  const [count, double] = useStore(myStore, "count", "double")

  return <button onClick={myStore.increment} />
}
```

## Features

### Stores

```ts
import { state, effect } from "react-bolt"

class MyStore {
  // read-write reactive value
  @state field: number

  constructor(init: number) {
    this.field = init
  }
}

const myStore = new MyStore(4)

const dispose = effect(() => {
  console.log(myStore.field)
})

myStore.field++ // simply assign the field to trigger effects

dispose() // dispose effect at any point
```

### Encapsulation

To encapsulate logic you can combine private fields and computed fields

```ts
import { state, computed } from "react-bolt"

class MyStore {
  @state private internal = ""

  @computed get public() {
    return this.internal + "heavy computation"
  }

  queueHeavyTask() {
    this.internal = "value"
  }

  // tip: define methods as read-only arrow functions which binds `this`
  // so it can be passed around e.g in `onClick={store.handler}`
  readonly handler = () => {}
}
```

`computed` values will be lazily computed when accessed. The value is
invalidated when any dependency changes.

### Nested stores

Stores can be nested.

```ts
class Book {
  @state title: string

  constructor(title: Pick<Book, "title">) {
    this.title = init.title
  }
}

class Author {
  @state books: Book[] = [
    new Book({ title: "Hello World" }),
    new Book({ title: "An awesome book" }),
  ]

  @computed get titles() {
    return this.books.map((book) => book.title)
  }
}
```

`titles` tracks the `books` field and each `title` field. When any of them
changes `titles` field is invalidated and effects are triggered.

### React hooks

In React use the `useStore` hook to subscribe to field value changes.

```tsx
import { useStore } from "react-bolt"
const books = useStore(author, "books")
const book1title = useStore(books[1], "title")

// specifying multiple fields will return them in an array
const [books, titles] = useStore(author, "books", "titles")
```

You can use the `useComputed` hook which will track reactive values in its
scope,

```tsx
import { useComputed } from "react-bolt"
// deeply tracks dependencies similarly to `computed`
const titles = useComputed(() => author.books.map((book) => book.title))
```

Alternatively, use the `createStoreHook` to wrap an instance of a store as a
hook.

```tsx
const useAuthor = createStoreHook(author)

const titles = useAuthor("titles")
const [books, titles] = useAuthor("books", "titles")
```

### Primitives

You can also use them as single value primitives

```ts
import { state, computed, effect } from "react-bolt"

const [a, setA] = state(1)
const [b, setB] = state(2)
const c = computed(() => a() + b())

effect(() => {
  console.log(c())
})

setA(a() + 1)
```
