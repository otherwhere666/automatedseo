/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Otherwhere brand colors
        ink: {
          DEFAULT: '#252525',
          secondary: '#4a4a4a',
          tertiary: '#6b6b6b',
          muted: '#8a8a8a',
        },
        paper: {
          DEFAULT: '#FFFEF3',
          secondary: '#FFFDF0',
          tertiary: '#F5F4E8',
        },
        accent: {
          DEFAULT: '#252525',
          hover: '#3a3a3a',
        },
        dark: {
          DEFAULT: '#252525',
          secondary: '#1a1a1a',
        },
      },
      fontFamily: {
        // Anton for bold headlines
        display: ['Anton', 'Impact', 'sans-serif'],
        // Editorial serif for headlines - like CN Traveller
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        // Hanken Grotesk for body text
        sans: ['"Hanken Grotesk"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'card': '20px',
        'card-lg': '24px',
      },
      fontSize: {
        // Editorial scale
        'hero': ['4rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'headline-lg': ['2.75rem', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        'headline': ['2rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'headline-sm': ['1.5rem', { lineHeight: '1.2', letterSpacing: '0' }],
        'subhead': ['1.125rem', { lineHeight: '1.5', letterSpacing: '0' }],
        'body': ['1.0625rem', { lineHeight: '1.7', letterSpacing: '0' }],
        'small': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.01em' }],
        'caption': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.05em' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      maxWidth: {
        'article': '720px',
        'wide': '1200px',
      },
      typography: ({ theme }) => ({
        editorial: {
          css: {
            '--tw-prose-body': theme('colors.ink.DEFAULT'),
            '--tw-prose-headings': theme('colors.ink.DEFAULT'),
            '--tw-prose-links': theme('colors.ink.DEFAULT'),
            '--tw-prose-bold': theme('colors.ink.DEFAULT'),
            '--tw-prose-quotes': theme('colors.ink.secondary'),
            '--tw-prose-quote-borders': theme('colors.ink.tertiary'),
            fontFamily: theme('fontFamily.sans').join(', '),
            fontSize: '1.0625rem',
            lineHeight: '1.7',
            'h1, h2, h3, h4': {
              fontFamily: theme('fontFamily.serif').join(', '),
              fontWeight: '400',
              letterSpacing: '-0.01em',
            },
            h1: {
              fontSize: '2.75rem',
              lineHeight: '1.1',
              marginTop: '3rem',
              marginBottom: '1.5rem',
            },
            h2: {
              fontSize: '2rem',
              lineHeight: '1.15',
              marginTop: '2.5rem',
              marginBottom: '1rem',
            },
            h3: {
              fontSize: '1.5rem',
              lineHeight: '1.2',
              marginTop: '2rem',
              marginBottom: '0.75rem',
            },
            p: {
              marginTop: '1.25rem',
              marginBottom: '1.25rem',
            },
            a: {
              color: theme('colors.ink.DEFAULT'),
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              textDecorationColor: theme('colors.ink.tertiary'),
              '&:hover': {
                textDecorationColor: theme('colors.ink.DEFAULT'),
              },
            },
            blockquote: {
              fontFamily: theme('fontFamily.serif').join(', '),
              fontSize: '1.375rem',
              fontStyle: 'normal',
              fontWeight: '400',
              lineHeight: '1.4',
              borderLeftWidth: '0',
              paddingLeft: '0',
              marginTop: '2.5rem',
              marginBottom: '2.5rem',
              color: theme('colors.ink.secondary'),
            },
            'blockquote p:first-of-type::before': {
              content: 'none',
            },
            'blockquote p:last-of-type::after': {
              content: 'none',
            },
            img: {
              marginTop: '2.5rem',
              marginBottom: '2.5rem',
            },
            figure: {
              marginTop: '2.5rem',
              marginBottom: '2.5rem',
            },
            figcaption: {
              fontSize: '0.875rem',
              color: theme('colors.ink.tertiary'),
              marginTop: '0.75rem',
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
