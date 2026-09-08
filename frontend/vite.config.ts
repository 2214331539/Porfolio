import { defineConfig } from 'vite';

// Bind on IPv4 and IPv6-capable interfaces so localhost and network browsers
// can reach the dev server consistently on Windows and in containerized setups.
export default defineConfig({
  server: {
    host: '0.0.0.0',
  },
  preview: {
    host: '0.0.0.0',
  },
});
