/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        clinic: {
          bg: "#F6FAFD",
          bg2: "#F8FBFF",
          blue: "#1E88E5",
          teal: "#00AFA5",
          navy: "#0F3D5E",
          line: "#D8E7F3",
          text: "#0F172A",
          muted: "#64748B"
        },
        risk: {
          low: "#22C55E",
          mid: "#F59E0B",
          high: "#EF4444"
        }
      },
      boxShadow: {
        clinical: "0 18px 45px rgba(30, 136, 229, 0.10)",
        soft: "0 10px 26px rgba(15, 76, 129, 0.08)"
      }
    }
  },
  plugins: []
};
