# squoosh-browser
An image compression tool run in browser while @squoosh/lib can not.

# origin
[Squoosh] is an image compression web app that reduces image sizes through numerous formats.

Since @squoosh/lib can not run in browser, squoosh-browser is designed to solve it.

# installation
```
yarn add @yireen/squoosh-browser
```

# config webpack
```js
module: {
    rules: [
      {
        test: /\.wasm/,
        type: 'asset/resource'
      }
    ]
  },
```

# usage
```ts
import Compress from '@yireen/squoosh-browser'

  const compress = new Compress(image);
  const compressFile = await compress.process();
}
```


[squoosh]: https://squoosh.app