/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const shim = (f: string) => fileURLToPath(new URL(`./src/shims/${f}`, import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // poker-ts requires Node's assert/crypto; tests run in Node so they keep the real ones.
  resolve: mode === 'test' ? {} : { alias: { assert: shim('assert.ts'), crypto: shim('crypto.ts') } },
  test: { environment: 'node' },
}))
