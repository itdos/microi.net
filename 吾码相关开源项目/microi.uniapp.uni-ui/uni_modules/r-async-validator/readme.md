# r-async-validator

[async-validator](https://github.com/yiminghe/async-validator)的压缩js，可直接在`uniapp`中使用

## 示例

```js
import { Schema } from "@/uni_modules/r-async-validator/js_sdk/index.js";

const descriptor = {
  name: {
    type: 'string',
    required: true,
    validator: (rule, value) => value === 'muji',
  },
  age: {
    type: 'number',
    asyncValidator: (rule, value) => {
      return new Promise((resolve, reject) => {
        if (value < 18) {
          reject('too young');  // reject with error message
        } else {
          resolve();
        }
      });
    },
  },
};
const validator = new Schema(descriptor);
validator.validate({ name: 'muji' }, (errors, fields) => {
  if (errors) {
    // validation failed, errors is an array of all errors
    // fields is an object keyed by field name with an array of
    // errors per field
    return handleErrors(errors, fields);
  }
  // validation passed
});

// PROMISE USAGE
validator.validate({ name: 'muji', age: 16 }).then(() => {
  // validation passed or without error message
}).catch(({ errors, fields }) => {
  return handleErrors(errors, fields);
});
```
