/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E1B1A", spruce: "#12332E", mist: "#EEF2F4", sage: "#5E8C7B",
        signal: "#F0A12B", coral: "#D6495B",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ['"Instrument Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
