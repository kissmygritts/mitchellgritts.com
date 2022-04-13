<template>
  <div class="pt-4 mx-auto max-4xl-px2">
    <div class="px-2 md:px-0">
      <div>
        <h1 class="py-2 text-3xl text-malachite capitalize">Snippets</h1>
        <p class="text-periwinkle">
          Short code snippets or notes that I stumble upon.
        </p>
      </div>

      <div class="mt-12 pb-16">

          <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div class="overflow-hidden">
                <table class="min-w-full divide-y-2 divide-gray-700">
                  <thead>
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-periwinkle opacity-80 uppercase tracking-wider">
                        Title
                      </th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-periwinkle opacity-80 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-periwinkle opacity-80 uppercase tracking-wider">
                        Topic
                      </th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-periwinkle opacity-80 uppercase tracking-wider">
                        Last Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-800">
                    <tr v-for="snippet in snippets" :key="snippet.slug">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-malachite">
                        <nuxt-link :to="snippet.path" class="hover:underline">
                          {{ snippet.title }}
                        </nuxt-link>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-periwinkle">
                        {{ snippet.description}}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-periwinkle">
                        {{ snippet.topic }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-periwinkle">
                        {{ toYMD(snippet.updatedOn) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ $content }) {
    const snippets = await $content('snippets')
      .only(['title', 'updatedOn', 'topic', 'description', 'slug', 'path'])
      .sortBy('updatedOn', 'desc')
      .fetch()

    return { snippets }
  },

  methods: {
    toYMD (date) {
      return new Date(date)
        .toISOString()
        .split('T')[0]
    }
  }
}
</script>
