---
title: "I shipped a side project over the weekend"
publishedOn: 2020-05-18
isPublished: true
category: projects
tags: [web development, r, nuxt, vue]
description: "Over the weekend I shipped a side project that was bouncing around my head for a few months!"
---

I suffer from shiny object syndrome when it comes to side projects. Every new, cool project that pops into my head turns me into a cat chasing a laser! Unfortunately this syndrome isn't coupled with the discipline required to finish a project, because a new, cool project eventually comes along and I turn back into the cat. Well, I decided to ignore all the shiny objects and actually complete a side project! Over this last week I built, and shipped a side project. This is how I built [r-code.dev](r-code.dev).

```js
/* network fargate service to load balancer */
const serviceOneTarget = serviceOne.loadBalancerTarget({
  containerName: `${name}_Container_ServiceOne_reallyLongNameToDemonstrateWhatHappensWithLongLinesOfCodeInThisExample`,
  containerPort: 7070
})

const listener = elb.addListener(`${name}_Listener`, {
  open: true,
  port: 80
})
listener.addTargets(`${name}_Targets`, {
  port: 80,
  targets: [serviceOneTarget],
  protocol: elbv2.Protocol.HTTP
})
```

## Inspiration

I stumbled upon [1loc.dev](https://1loc.dev) the other day and thought it was a really cool website. Tons of helpful JavaScript tips. Many of those tips I had learned in the past but forgotten. Over the next few days I kept thinking it might be interesting to build a similar website for R code. I waffled for a few days about whether or not I should build it. Once I finally settled on building it, I couldn't decide how I should build it. I did, however, know two things:

1. The content will be written in markdown
2. I want to use a static site generator
3. (Okay, three things), I want to deploy it on Netlify

## Tech

I've used Gridsome and Eleventy in the past. I really wanted to use Vue for this, so Eleventy is out. Gridsome is great, I really like using it for this website, but, I didn't really want to just recreate this website. 

Over the last year I've been looking for excuses for Nuxt or VuePress. I figured I'll decided to use one of these for this website. I went back and forth between the two. In about 30 minutes I was able to get markdown to render with VuePress. VuePress also comes with a ton of nice features built in. However, I wanted more flexibility with how to build the website. 

That left Nuxt. It wasn't the easiest thing to get off the ground. I restarted about 3 times. Complete, hard resets - `rm -rf` type of hard resets. I almost gave up a few times too. I'm not going to lie I hard a lot of trouble getting Nuxt setup to render markdown content the way I wanted to.

## How do you eat an elephant 

I tend to get overwhelmed with my own ambitions when starting a new project. There is an entire world of possibilities. More often than not this all these prossibilities cause me to eventually give up. I think too long and hard about how to build the "this feature sounds cool" ideas and not enough time actually building. I decided that I would not let that happen this time. I very clearly laid out the very minimum that would be required to get the website working. 

I've been reading [Get Real](https://basecamp.com/books/getting-real) by the Basecamp team. It inspired be to drop all the crap and focus on the core features. So, these were the things I started planing and building.

1. Setup Nuxt
1. List markdown files on the home screen
1. Render content of the markdown at the proper route
1. Generate static site
1. Style website
1. Deploy to Netlify

And I went after it. Once I checked something off I moved onto the next step. It was nice not having to think about what comes next. As silly as it might sound I rarely layout projects like this. A lot of the time it's a free for all.

## Moving forward

There are a few features that I have planned for this website.

1. Search bar - I don't know how to do this yet, but it'll be a helpful feature
1. More info in YAML header - This really depends, add things like related snippets, R packages used, Contributed by, etc.
1. Embed runable R code examples, maybe? Seems like a good idea.
1. Dark mode!
1. Moar content!

Please contribute if you have an additional thoughts, feedback, content suggestions.