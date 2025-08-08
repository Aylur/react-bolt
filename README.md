# React Bolt

Reactive stores using decorators.

```ts
class MyStore extends Store {
  @field count1 = 1
  @field count2 = 1

  @computed get sum() {
    return this.count1 + this.count2
  }
}

export const model = new Model()
```

```tsx
import { useStoreSelection, useStore } from "react-bolt"

function Sum() {
  const sum = useStore(model, "sum")
  return <b>{sum}</b>
}

function App() {
  const [c1, c2] = useStoreSelection(model, "count1", "count2")

  return (
    <h1>
      {c1} + {c2} = <Sum />
    </h1>
  )
}
```
