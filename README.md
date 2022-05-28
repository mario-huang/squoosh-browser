# squoosh-browser
An image compression tool run in browser while @squoosh/lib can not.

# origin
[Squoosh] is an image compression web app that reduces image sizes through numerous formats.

Since @squoosh/lib can not run in browser, squoosh-browser is designed to solve it.

It can process almost all image formats, such as "pdf", "gif", "png", "jpeg", "bmp", "tiff", "webp", "webp2", "avif", "jxl".

# installation
```
yarn add @yireen/squoosh-browser
```

If you use webpack4, you also need
```
yarn add file-loader --dev
```

# config
For Vite
```js
// vite.config.js
const config = {
  optimizeDeps: {
    exclude: ['@yireen/squoosh-browser'],
  }
}
```

For webpack5
```js
// webpack.config.js
module: {
  rules: [
    {
      test: /\.wasm/,
      type: 'asset/resource'
    }
  ]
}
```

For webpack4
```js
// webpack.config.js
module: {
  rules: [
    {
      test: /\.wasm/,
      use: [
        {
          loader: 'file-loader'
        }
      ]
    }
  ]
}
```

# usage
```ts
import Compress from '@yireen/squoosh-browser'

  const compress = new Compress(image);
  const compressFile = await compress.process();
}
```


[squoosh]: https://squoosh.app
