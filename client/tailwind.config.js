/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07070c",
          900: "#0c0c16",
          800: "#14141f",
          700: "#1c1c2c",
          600: "#26263a",
        },
        neon: {
          cyan: "#2de6ff",
          green: "#3dffa0",
          purple: "#b25bff",
          pink: "#ff4fd8",
          gold: "#ffd23f",
          red: "#ff4560",
        },
      },
      fontFamily: {
        display: ["'Orbitron'", "'Rajdhani'", "system-ui", "sans-serif"],
        body: ["'Rajdhani'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'Share Tech Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        neon: "0 0 8px rgba(45,230,255,0.55), 0 0 24px rgba(45,230,255,0.25)",
        "neon-purple": "0 0 8px rgba(178,91,255,0.55), 0 0 24px rgba(178,91,255,0.25)",
        "neon-green": "0 0 8px rgba(61,255,160,0.55), 0 0 24px rgba(61,255,160,0.25)",
        "neon-red": "0 0 8px rgba(255,69,96,0.55), 0 0 20px rgba(255,69,96,0.25)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(45,230,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(45,230,255,0.06) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "28px 28px",
      },
    },
  },
  plugins: [],
};
