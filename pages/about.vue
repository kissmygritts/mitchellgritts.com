<template>
  <article class="pt-4 mx-auto max-w-3xl px-2">
    <nuxt-content class="py-16 px-2 md:px-0 prose prose-lg md:prose-xl prose-periwinkle" :document="about" />  
  </article>
</template>

<script>
export default {
  async asyncData({ $content, params }) {
    const about = await $content('about').fetch()

    return { about: about[0] }
  }
}
</script>