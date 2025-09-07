import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import viteCompression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(), // เปิดใช้งาน Vue DevTools
    // Pre-compress assets (Brotli by default) to reduce transfer size
    viteCompression({ algorithm: 'brotliCompress', ext: '.br', deleteOriginFile: false }),
    // Also provide gzip as fallback for older clients/CDNs
    viteCompression({ algorithm: 'gzip', ext: '.gz', deleteOriginFile: false }),
    // Bundle visualizer (generate stats on build; open stats.html manually when needed)
    visualizer({ filename: 'dist/bundle-stats.html', gzipSize: true, brotliSize: true }),
  ],
  build: {
    // Keep previous hashed chunks so users with long-lived cached entry bundles
    // can still fetch their referenced dynamic imports after a new deploy.
    // (Prevents 404 -> index.html -> MIME type text/html errors.)
    // NOTE: This will grow Hosting storage; periodically prune old dist assets in CI if needed.
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router'],
          'vendor-firebase': [
            'firebase/app',
            'firebase/firestore',
            'firebase/storage',
            'firebase/auth',
          ],
          // pdf generation libs loaded lazily; no manual chunk
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // Reduce duplicated firebase sub-packages across dynamic graphs
    experimentalDedupe: ['firebase', '@firebase/app', '@firebase/firestore', '@firebase/auth'],
  },
  server: {
    proxy: {
      '/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/openai\//, '/'),
      },
      // Cloud Functions (asia-southeast1) proxies for dev to avoid CORS
      '/api/scenario': {
        target: 'https://asia-southeast1-ai-hots-platform.cloudfunctions.net',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/aiScenario',
      },
      '/api/assessment': {
        target: 'https://asia-southeast1-ai-hots-platform.cloudfunctions.net',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/aiAssessment',
      },
      '/api/evaluate': {
        target: 'https://asia-southeast1-ai-hots-platform.cloudfunctions.net',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/aiEvaluate',
      },
      '/api/teaching-strategy': {
        target: 'https://asia-southeast1-ai-hots-platform.cloudfunctions.net',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/aiTeachingStrategy',
      },
      '/api/analyze': {
        target: 'https://asia-southeast1-ai-hots-platform.cloudfunctions.net',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/analyzeSubmission',
      },
      '/api/similarity': {
        target: 'https://asia-southeast1-ai-hots-platform.cloudfunctions.net',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/similarityCheck',
      },
      '/api/leaderboard': {
        target: 'https://asia-southeast1-ai-hots-platform.cloudfunctions.net',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/courseLeaderboard',
      },
    },
  },
})
