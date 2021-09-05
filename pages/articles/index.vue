<template>
  <div class="pt-4 mx-auto max-w-3xl px-2">
    <div class="px-2 md:px-0">
      <h1 class="py-2 text-3xl text-electric-blue capitalize">All Articles</h1>

      <div class="space-y-2 mt-2 pb-16">
        <div v-for="article in articles" :key="article.slug" class="py-1 group">
          <nuxt-link :to="article.path" class="w-full">
          <h3 class="text-xl capitalize leading-none text-periwinkle group-hover:text-malachite">{{ article.title }}</h3>
            <ul class="mt-1 flex space-x-1 font-light opacity-60">
              <li v-for="tag in article.tags" :key="tag" class="block capitalize">#{{ tag }} </li>
            </ul>
          </nuxt-link>
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
      .fetch()

    return { articles }
  }
}
</script>