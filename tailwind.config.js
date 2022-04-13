module.exports = {
  theme: {
    extend: {
      colors: {
        'midnight-blue': '#222941',
        'electric-blue': '#26D8EC',
        'malachite': '#C2FFAD',
        'minion-yellow': '#ffe74c',
        'hot-pink': '#F680F5',
        'periwinkle': '#F2F3F8',
        'cool-gray': '#4B6479'
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#F2F3F8',
            a: {
              color: '#26D8EC',
              '&:hover': {
                color: '#C2FFAD'
              }
            },
            'a code': {
              color: '#26D8EC',
              '&:hover': {
                color: '#26D8EC'
              }
            },
            'h1, h2, h3, h4, h5': {
              color: '#C2FFAD',
              'font-weight': 'normal'
            },
            // h1: { color: '#C2FFAD' },
            // h2: { color: '#C2FFAD' },
            // h3: { color: '#C2FFAD' },
            // h4: { color: '#C2FFAD' },
            // h5: { color: '#C2FFAD' },
            code: {
              color: '#F2F3F8',
              opacity: 0.8
            },
            'pre code': {
              'font-size': '0.875rem'
            },
            'code[class*="language-"], pre[class*="language-"]': {
              'line-height': '1.25rem'
            },
            ':not(pre) > code[class*="language-"], pre[class*="language-"]': {
              'background-color': '#011023',
              // border: '1px solid #9ab7bc80'
            },
            strong: { color: '#F2F3F8' },
            blockquote: {
              color: '#26D8EC',
              'border-left-color': '#26D8EC',
              opacity: 0.8
            },
            th: {
              color: '#F2F3F8',
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
      `assets/css/tailwind.css`,
      `nuxt.config.{js,ts}`,
    ],
  },
}
