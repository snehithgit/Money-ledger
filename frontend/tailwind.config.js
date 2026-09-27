/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12161c",
        surface: "#ffffff",
        muted: "#6b7280",
        line: "#e5e7eb",
        income: "#0f9d58",
        expense: "#d93025",
        accent: "#5b3df6",
        accent2: "#8b5cf6",
      },
      boxShadow: {
        hero: "0 12px 30px -12px rgba(91, 61, 246, 0.45)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
