/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#132a3a',
        'ink-soft': '#21465e',
        mist: '#b8cfe5',
        coral: '#dd5d46',
        'coral-deep': '#bd4937',
        marker: '#f2be45',
        paper: '#f5f7f8',
        graphite: '#1e2933',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        sans: ['"Instrument Sans"', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
