module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      zIndex: {
        51: '51',
      },
    },
  },
  plugins: [],
  purge: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
};

