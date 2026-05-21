import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // مقادیر env رو موقع build داخل کد جایگذاری می‌کنه
  const define: Record<string, string> = {
    '__FIREBASE_API_KEY__':             JSON.stringify(env.FIREBASE_API_KEY             ?? ''),
    '__FIREBASE_AUTH_DOMAIN__':         JSON.stringify(env.FIREBASE_AUTH_DOMAIN         ?? ''),
    '__FIREBASE_PROJECT_ID__':          JSON.stringify(env.FIREBASE_PROJECT_ID          ?? ''),
    '__FIREBASE_STORAGE_BUCKET__':      JSON.stringify(env.FIREBASE_STORAGE_BUCKET      ?? ''),
    '__FIREBASE_MESSAGING_SENDER_ID__': JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID ?? ''),
    '__FIREBASE_APP_ID__':              JSON.stringify(env.FIREBASE_APP_ID              ?? ''),
    '__GOOGLE_CLIENT_ID__':             JSON.stringify(env.GOOGLE_CLIENT_ID             ?? ''),
    '__GOOGLE_CLIENT_SECRET__':         JSON.stringify(env.GOOGLE_CLIENT_SECRET         ?? '')
  }

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define
    },
    preload: {
      plugins: [externalizeDepsPlugin()]
    },
    renderer: {
      resolve: {
        alias: { '@renderer': resolve('src/renderer/src') }
      },
      plugins: [react()]
    }
  }
})
