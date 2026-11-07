import { defineConfig } from 'vite';

// Bind on IPv4 and IPv6-capable interfaces so localhost and network browsers
// can reach the dev server consistently on Windows and in containerized setups.
export default defineConfig({
  server: {
    host: '0.0.0.0',
    proxy: {
      '/server-deck': {
        target: 'http://127.0.0.1:4318',
        rewrite: (path) => path.replace(/^\/server-deck/, ''),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    proxy: {
      '/server-deck': {
        target: 'http://127.0.0.1:4318',
        rewrite: (path) => path.replace(/^\/server-deck/, ''),
      },
    },
  },
});
