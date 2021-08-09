module.exports = {
  theme: {
    extend: {
      colors: {
        'midnight-blue': '#011023',
        'electric-blue': '#5FE4F6',
        'malachite': '#22DA6E',
        'minion-yellow': '#ffe74c',
        'hot-pink': '#F680F5',
        'periwinkle': '#D6DEEB',
        'cool-gray': '#4B6479'
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#D6DEEB',
            a: {
              color: '#22DA6E',
              '&:hover': {
                color: '#5FE4F6'
              }
            },
            h1: { color: '#22DA6E' },
            h2: { color: '#22DA6E' },
            h3: { color: '#22DA6E' },
            h4: { color: '#22DA6E' },
            h5: { color: '#22DA6E' },
            code: {
              color: '#D6DEEB',
              opacity: 0.8
            },
            'pre code': {
              'font-size': '0.875rem'
            },
            'code[class*="language-"], pre[class*="language-"]': {
              'line-height': '1.25rem'
            },
            strong: { color: '#D6DEEB' },
            blockquote: {
              color: '#5FE4F6',
              'border-left-color': '#5FE4F6',
              opacity: 0.8
            }
          }
        }
      }
    }
  },
  variants: {},
  plugins: [require('@tailwindcss/typography')],
  purge: {
    content: [
      `components/**/*.{vue,js}`,
      `layouts/**/*.vue`,
      `pages/**/*.vue`,
      `plugins/**/*.{js,ts}`,
      `nuxt.config.{js,ts}`,
    ],
  },
}
