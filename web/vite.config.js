import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appVersion = readFileSync(resolve(projectRoot, 'VERSION'), 'utf-8').trim()

if (!appVersion) {
  throw new Error('VERSION 文件为空')
}

const injectAppVersion = () => ({
  name: 'inject-app-version',
  transformIndexHtml(html) {
    return html.replaceAll('%APP_VERSION%', appVersion)
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [injectAppVersion(), vue(), tailwindcss()],
})
