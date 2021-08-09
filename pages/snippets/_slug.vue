<template>
  <article class="pt-4 mx-auto max-w-3xl px-2">
    <div class="px-2 md:px-0">
      <h1 class="text-4xl text-malachite capitalize">{{ snippet.title }}</h1>
      <p class="mt-2 font-light opacity-75">
        Topic:
        <span class="mr-1">#{{ snippet.topic }}</span>
      </p>
    </div>

    <nuxt-content class="py-16 px-2 md:px-0 prose prose-lg md:prose-xl prose-periwinkle" :document="snippet" />

  </article>  
</template>

<script>
export default {
  async asyncData({ $content, params }) {
    const snippet = await $content('snippets', params.slug).fetch()

    return { snippet }
  }
}
</script>
