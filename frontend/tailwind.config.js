/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17191F",
        surface: "#FFFFFF",
        muted: "#6B7280",
        line: "#E5E7EB",
        income: "#15803D",
        expense: "#C2413A",
        accent: "#4F46E5",
        accent2: "#7C3AED",
      },
      boxShadow: {
        hero: "0 18px 45px -24px rgba(79, 70, 229, 0.45)",
      },
    },
  },
  plugins: [],
};
