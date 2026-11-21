/// <reference types="vitest/config" />
import { defineConfig, type Connect, type Plugin } from 'vite'
import type { ServerResponse } from 'node:http'
import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join, normalize, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const DATA_SRC = resolve(process.cwd(), 'src/json')
const DATA_OUT = resolve(process.cwd(), 'dist/json')

/**
 * Serve `src/json/` in sviluppo e lo copia in `dist/json/` alla build: i dati del
 * POC sono file JSON letti con `fetch('./json/...')`, percorsi relativi compresi
 * (AGENTS.md: niente database, tutto in src/json/).
 */
function copyJsonData(): Plugin {
  return {
    name: 'copy-json-data',
    configureServer(server) {
      server.middlewares.use(
        (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          const url = (req.url ?? '').split('?')[0]
          if (!url.startsWith('/json/')) {
            next()
            return
          }
          const filePath = join(DATA_SRC, normalize(url.slice('/json/'.length)))
          if (!existsSync(filePath) || !statSync(filePath).isFile()) {
            next()
            return
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(readFileSync(filePath))
        },
      )
    },
    closeBundle() {
      if (existsSync(DATA_SRC)) {
        mkdirSync(DATA_OUT, { recursive: true })
        cpSync(DATA_SRC, DATA_OUT, { recursive: true })
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), copyJsonData()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
