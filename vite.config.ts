import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tanstackStart({
      client: { entry: './src/client.tsx' },
      server: { entry: './src/entry-server.tsx' },
    }),
    tailwindcss(),
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    react(),
  ],
  resolve: {
    alias: { '@': `${process.cwd()}/src` },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  server: { port: 8081 },
})