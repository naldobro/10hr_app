/** @type {import('tailwindcss').Config} */

// The `stone` neutral ramp and the `paper` surface are driven by CSS variables
// (see src/index.css) so a single `.dark` class on <html> re-themes the whole
// app. Colors are declared with the `<alpha-value>` channel pattern so Tailwind
// opacity modifiers (e.g. `bg-stone-100/60`) keep working. Accent hues (amber,
// red, emerald, …) are intentionally left as Tailwind defaults in both themes.
const stone = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        stone: {
          50: stone('--stone-50'),
          100: stone('--stone-100'),
          200: stone('--stone-200'),
          300: stone('--stone-300'),
          400: stone('--stone-400'),
          500: stone('--stone-500'),
          600: stone('--stone-600'),
          700: stone('--stone-700'),
          800: stone('--stone-800'),
          900: stone('--stone-900'),
        },
        // Semantic surface used for `dark:` overrides of raw `bg-white` cards.
        paper: 'rgb(var(--surface) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
