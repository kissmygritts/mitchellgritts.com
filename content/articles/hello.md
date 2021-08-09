---
title: Getting started
publishedOn: 2021-05-18
isPublished: false
category: projects
tags: [web development, r, nuxt, vue]
description: 'Empower your NuxtJS application with @nuxt/content module: write in a content/ directory and fetch your Markdown, JSON, YAML and CSV files through a MongoDB like API, acting as a Git-based Headless CMS.'
---

Empower your NuxtJS application with `@nuxtjs/content` module: write in a `content/` directory and fetch your Markdown, JSON, YAML and CSV files through a MongoDB like API, acting as a **Git-based Headless CMS**.

* strong: **strong**
* italic: *italic*
* inline code: `inline code`
* strikethrough: ~~strikethrough~~

> quotes of somethings or other

Here's a simple footnote,[^1] and here's a longer one.[^bignote]

[^1]: This is the first footnote.

[^bignote]: Here's one with multiple paragraphs and code.

    Indent paragraphs to include them in the footnote.

    `{ my code }`

    Add as many paragraphs as you like.

## Writing content

Learn how to write your `content/`, supporting Markdown, YAML, CSV and JSON: https://content.nuxtjs.org/writing.

## Fetching content

Learn how to fetch your content with `$content`: https://content.nuxtjs.org/fetching.

```js{1}[server.js]
const http = require('http')
const bodyParser = require('body-parser')

http.createServer((req, res) => {
  bodyParser.parse(req, (error, body) => {
    res.end(body)
  })
}).listen(3000)
```

## Displaying content

Learn how to display your Markdown content with the `<nuxt-content>` component directly in your template: https://content.nuxtjs.org/displaying.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam elit velit, hendrerit a nisl ut, volutpat egestas lacus. Vivamus porttitor scelerisque eros, nec egestas nisi facilisis eget. In hendrerit, nulla non aliquam varius, est mauris porta metus, sed dignissim nulla nisl id orci. In eros sem, feugiat at laoreet a, congue et magna. Aenean hendrerit ex enim, nec iaculis mauris accumsan nec. Duis accumsan urna in fermentum semper. Maecenas bibendum mi a odio luctus, vel tincidunt augue cursus. Aenean nec mollis velit. Proin vel euismod ex, non varius tellus.

Pellentesque suscipit, eros sed posuere iaculis, leo sapien placerat odio, non posuere turpis tortor vitae sapien. Suspendisse fringilla eros faucibus, blandit lorem eu, placerat lacus. Nullam vitae urna nec mi rhoncus tempus nec eu velit. Aliquam ante purus, aliquet in ipsum eu, tempor efficitur libero. Sed sodales eleifend elit, a ultricies enim. Sed semper nisi sed aliquam ullamcorper. Mauris dapibus, ligula eget mattis tristique, erat lectus pretium sapien, sodales tincidunt odio eros a erat. Sed commodo dapibus dignissim. Nam congue, magna quis bibendum commodo, sapien tellus condimentum arcu, id tincidunt arcu dolor nec lorem. Vestibulum tempor ipsum orci, in vehicula magna aliquet sit amet. Vivamus ac tincidunt arcu. Nulla rutrum libero metus.

Praesent molestie justo tellus, ut molestie nulla mollis ut. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec ut lorem sollicitudin, rutrum elit vel, varius quam. Suspendisse porttitor nibh cursus est rhoncus, non rhoncus massa dictum. Suspendisse ultrices neque pellentesque, accumsan mi vitae, vestibulum purus. Pellentesque lobortis risus a ex semper, non auctor sem maximus. Cras porta sit amet sapien rutrum posuere. Fusce blandit, augue sed placerat dignissim, leo ligula dapibus nunc, in gravida augue tortor vitae sapien. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Praesent vitae luctus erat. Aenean eu mauris justo. Curabitur tellus risus, pharetra vel mi a, aliquam sodales urna. In ornare venenatis eleifend.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec congue tortor sit amet leo rutrum laoreet. Nullam semper mollis velit non facilisis. Suspendisse ornare magna lacinia, consectetur ex ut, aliquam turpis. Donec consectetur ultrices massa sed placerat. Proin venenatis nulla lorem, a laoreet nisl convallis quis. Curabitur dictum vestibulum justo, quis rutrum ligula efficitur quis. Suspendisse ultrices, ligula nec facilisis fermentum, mi diam tempor magna, et tempor urna lorem in justo. Donec sed nisi nisl. Aliquam tempor blandit dolor non viverra. Sed bibendum vulputate lacus quis scelerisque. Aliquam erat volutpat. Nunc vitae tristique urna.

Suspendisse varius sagittis ipsum eu volutpat. Maecenas id auctor orci. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec luctus imperdiet ex, eu mollis purus efficitur eget. Donec vel enim odio. Aliquam euismod dapibus arcu vitae consequat. Donec viverra, dui non mollis efficitur, nisl purus elementum ligula, at ullamcorper enim arcu vitae est. Donec tristique lorem nisl, nec porttitor purus consequat vel. Integer sit amet ipsum non orci pretium placerat vitae non mauris. Fusce nec efficitur ipsum, ut imperdiet purus. Integer risus ex, laoreet ut tincidunt ut, semper at erat.
