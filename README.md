# React Bolt

Yet another client side state management library

```tsx
import { field, computed, useStore } from "react-bolt"

class MyStore {
  @field count = 1

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
import { field, subscribe, effect } from "react-bolt"

class MyStore {
  // read-write reactive value
  @field field: number

  constructor(init: number) {
    this.field = init
  }
}

const myStore = new MyStore(4)

const dispose = effect(() => {
  console.log(myStore.field)
})

myStore.field++ // simply mutate the field to invoke subscription callbacks

dispose() // dispose effect at any point
```

### Encapsulation

To encapsulate logic you can combine private fields and computed fields

```ts
import { Store, field, computed } from "react-bolt"

class MyStore extends Store {
  @field private internal: string

  @computed get public() {
    return this.internal + "heavy computation"
  }

  queueHeavyTask() {
    this.internal = "value"
  }

  // tip: define methods as readonly arrow functions which binds `this`
  // so it can be passed around e.g in `onClick={store.handler}`
  readonly handler = () => {}
}
```

`computed` will be lazily computed when accessed. The value is invalidated when
any dependency changes.

### Nested stores

Stores can be nested.

```ts
class Book {
  @field title: string

  constructor(title: Pick<Book, "title">) {
    this.title = init.title
  }
}

class Author extends Store {
  @field books: Book[] = [
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

In React use the `useStore` hook to subscribe to value changes.

```tsx
const books = useStore(author, "books")
const book1title = useStore(books[1], "title")
```

You can use the `useBolt` hook which will track reactive values in its scope,

```tsx
// deeply tracks dependencies similarly to `computed`
const titles = useBolt(() => author.books.map((book) => book.title))
```

Alternatively, use the `createStoreHook` to wrap an instance of a store as a
hook.

```tsx
const useAuthor = createStoreHook(author)

const titles = useAuthor("titles")
const [books, titles] = useAuthor("books", "titles")
```

### Primitives

You can also directly use the underlying primitives

```ts
import { atom, computed, effect } from "react-bolt"

const a = atom(1)
const b = atom(2)
const c = computed(() => a() + b())

effect(() => {
  console.log(c())
})

a.set(a() + 1)
```
