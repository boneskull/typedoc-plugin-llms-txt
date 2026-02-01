---
title: Configuration
category: Guides
---

Learn how to configure the Example Library.

## Greeter Options

The `Greeter` class accepts the following options:

| Option    | Type      | Default   | Description                      |
| --------- | --------- | --------- | -------------------------------- |
| `prefix`  | `string`  | `'Hello'` | The greeting prefix              |
| `excited` | `boolean` | `true`    | Whether to use exclamation marks |

## Example

```ts
import { Greeter } from 'example-lib';

const greeter = new Greeter({
  prefix: 'Hi',
  excited: false,
});

console.log(greeter.greet('there')); // "Hi, there."
```
