import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base './' lets the site work under any GitHub Pages sub-path (https://name.github.io/repo/).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
