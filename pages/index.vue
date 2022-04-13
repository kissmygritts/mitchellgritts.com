<template>
  <div class="w-full text-periwinkle pb-16">
    <div class="w-full flex justify-center">
      <div class="rounded-full">
        <img src="/nasa_250x250.jpg" alt="drawing nasa astronaut with text we need you" class="rounded-full block">
      </div>
    </div>
    <div class="mt-8 text-xl font-light px-4 md:px-24 lg:px-0 text-left md:text-center">
      <h2 class="text-3xl leading-tight">Howdy, My Name is Mitchell Gritts</h2>
      <p class="py-1 mt-2">
        I'm a wildlife ecologist, data analyst, and web developer based in Reno, Nevada.
      </p>

      <div class="mt-10 text-left max-w-3xl mx-auto">
        <h2 class="py-2 text-3xl font-light text-malachite">Recent Articles</h2>
        
        <div class="space-y-2 mt-2">
          <div v-for="article in articles" :key="article.slug" class="py-1 group">
            <nuxt-link :to="article.path" class="w-full">
            <h3 class="text-xl leading-none text-periwinkle group-hover:text-electric-blue">{{ article.title }}</h3>
            <p class="leading-none mt-1 text-sm opacity-60">{{ article.tags.join(', ') }}</p>
            </nuxt-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const isDev = process.env.NODE_ENV === 'development'

export default {
  async asyncData({ $content }) {
    const where = isDev ? {} : { isPublished: true }
    
    const articles = await $content('articles')
      .where(where)
      .only(['title', 'description', 'slug', 'tags', 'path'])
      .sortBy('publishedOn', 'desc')
      .limit(10)
      .fetch()

    return { articles }
  }
}
</script>
