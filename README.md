# React Bolt

Reactive stores using decorators.

```tsx
class MyStore extends Store {
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

Bolt uses classes and decorators which allows stores to encapsulate logic and
behave as a data model for React apps. It was inspired by Svelte's reactive
classes.

### Stores

```ts
import { Store, field, subscribe } from "react-bolt"

class MyStore extends Store {
  // read-write reactive value
  @field field: number

  constructor(init: number) {
    super()
    this.field = init
  }
}

const myStore = new MyStore(4)

const dispose = subscribe(myStore, "field", () => {
  console.log(myStore.field)
})

myStore.field++ // simply mutate the field to invoke subscription callbacks

dispose() // unsubscribe at any point
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

`@computed` results are cached and will be lazily computed when accessed. The
cached value is invalidated when any dependency changes.

### Nested stores

Stores can be nested.

```ts
class Book extends Store {
  @field title: string

  constructor(init: Pick<Book, "title">) {
    super()
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
changes `titles` field is invalidated and subscriptions are executed.

In order for a computed field to know its dependencies it has to be computed.

```ts
const author = new Author()

subscribe(author, "titles", () => {
  console.log(author.titles)
})

// without this line the subscription callback is not invoked because
// it does not yet know that books is a dependency yet.
author.titles

author.books = [...author.books, new Book()]
```

### React hooks

In React use the `useStore` hook to subscribe to value changes.

```tsx
function Component() {
  const books = useStore(author, "books")
  const book1title = useStore(books[1], "title")

  // selector which will also deeply track dependencies, similarly to @computed
  const titles = useStore(author, (s) => s.books.map((book) => book.title))
}
```

Alternatively, use the `createStoreHook` for an instance of store.

```tsx
const useAuthor = createStoreHook(new Author())

function Component() {
  const titles = useAuthor("titles")
  const [books, titles] = useAuthor("books", "titles")
}
```

## Decorators version

The `react-bolt` module uses stage 3 decorators so make sure that
`experimentalDecorators` in tsconfig is disabled.

To use stage 2 decorators with `experimentalDecorators` turned on use the
`react-bolt/legacy` module.
