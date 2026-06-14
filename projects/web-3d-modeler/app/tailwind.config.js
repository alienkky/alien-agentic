/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // AA 디자인 토큰 (자체 IP 브랜딩) — CSS 변수 경유
        "aa-bg": "var(--aa-bg)",
        "aa-surface": "var(--aa-surface)",
        "aa-surface-2": "var(--aa-surface-2)",
        "aa-border": "var(--aa-border)",
        "aa-text": "var(--aa-text)",
        "aa-text-dim": "var(--aa-text-dim)",
        "aa-accent": "var(--aa-accent)",
        "aa-accent-dim": "var(--aa-accent-dim)",
      },
      fontFamily: {
        sans: ["Pretendard", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
