/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wa: {
          teal: '#075E54',
          dark: '#128C7E',
          green: '#25D366',
          lightGreen: '#d9fdd3',
          chatBg: '#0b141a',
          bubbleOut: '#005c4b',
          bubbleIn: '#202c33',
          header: '#202c33',
          sidebar: '#111b21',
          border: '#222d34',
          muted: '#8696a0',
          active: '#00a884'
        }
      }
    }
  },
  plugins: []
};
