/** @type {import('tailwindcss').Config} */

// Todos los colores de la app viven como variables CSS (ver src/index.css:
// :root para el tema oscuro, [data-theme="light"] para el claro), en vez de
// hex fijos. `withVar` arma el patrón rgb(var(--x) / <alpha-value>) que
// Tailwind necesita para que sigan funcionando los modificadores de opacidad
// (ej. "border-neon-cyan/60") sin tener que tocar ningún componente.
function withVar(name) {
  return `rgb(var(--${name}) / <alpha-value>)`;
}

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: withVar("ink-950"),
          900: withVar("ink-900"),
          800: withVar("ink-800"),
          700: withVar("ink-700"),
          600: withVar("ink-600"),
        },
        neon: {
          cyan: withVar("neon-cyan"),
          green: withVar("neon-green"),
          purple: withVar("neon-purple"),
          pink: withVar("neon-pink"),
          gold: withVar("neon-gold"),
          red: withVar("neon-red"),
        },
        // Solo los tonos de "slate" que la app realmente usa -- el resto de
        // la paleta default de Tailwind (700 en adelante) sigue intacta.
        slate: {
          100: withVar("slate-100"),
          200: withVar("slate-200"),
          300: withVar("slate-300"),
          400: withVar("slate-400"),
          500: withVar("slate-500"),
          600: withVar("slate-600"),
        },
      },
      fontFamily: {
        display: ["'Orbitron'", "'Rajdhani'", "system-ui", "sans-serif"],
        body: ["'Rajdhani'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'Share Tech Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        neon: "0 0 8px rgb(var(--neon-cyan) / var(--glow-alpha)), 0 0 24px rgb(var(--neon-cyan) / calc(var(--glow-alpha) * 0.45))",
        "neon-purple": "0 0 8px rgb(var(--neon-purple) / var(--glow-alpha)), 0 0 24px rgb(var(--neon-purple) / calc(var(--glow-alpha) * 0.45))",
        "neon-green": "0 0 8px rgb(var(--neon-green) / var(--glow-alpha)), 0 0 24px rgb(var(--neon-green) / calc(var(--glow-alpha) * 0.45))",
        "neon-red": "0 0 8px rgb(var(--neon-red) / var(--glow-alpha)), 0 0 20px rgb(var(--neon-red) / calc(var(--glow-alpha) * 0.45))",
      },
      backgroundImage: {
        grid: "linear-gradient(rgb(var(--grid-line) / var(--grid-alpha)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--grid-line) / var(--grid-alpha)) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "28px 28px",
      },
    },
  },
  plugins: [],
};
