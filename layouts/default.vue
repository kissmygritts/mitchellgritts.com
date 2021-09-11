<template>
  <div class="flex flex-col justify-between min-h-screen bg-midnight-blue text-periwinkle">
    <div class="mx-auto w-full max-w-5xl">

      <!-- header -->
      <div class="flex items-center justify-between px-2 lg:px-0 py-4 text-periwinkle">  
          <div class="text-normal md:text-2xl py-1">
            <nuxt-link to="/" class="hover:text-electric-blue">
              Mitchell Gritts
            </nuxt-link>
          </div>
          <div class="flex space-x-6 text-sm md:text-lg py-1 px-2 opacity-80">
            <span class="inline-block hover:text-electric-blue">
              <nuxt-link to="/articles">Articles</nuxt-link>
            </span>
            <span class="inline-block hover:text-electric-blue">
              <nuxt-link to="/snippets">Snippets</nuxt-link>
            </span>
            <span class="inline-block hover:text-electric-blue">
              <nuxt-link to="/about">About Me</nuxt-link>
            </span>
          </div>
        </div>

      <!-- content  -->
      <nuxt class="mt-8 text-periwinkle" />
    </div>

    <!-- footer -->
    <footer class="mx-auto w-full max-w-5xl py-8 border-t border-gray-800">
      <p class="text-small text-center">
        <a href="https://github.com/kissmygritts" class="underline text-malachite">GitHub</a> :: everything here is 
        <a href="https://unlicense.org/" class="underline text-malachite">Unlicensed</a>
      </p>
    </footer>
  </div>
</template>
