/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { SPECIALIZATIONS } from './src/data/specializations.js'

// Public site URL for absolute sitemap URLs. Override with VITE_SITE_URL in the
// build environment (e.g. a custom domain); falls back to the Vercel domain.
const SITE_URL = (process.env.VITE_SITE_URL || 'https://hospital-booking-nine.vercel.app')
  .replace(/\/$/, '')

// A unique id for this build. On Vercel we prefer the git commit SHA (stable per
// deploy); otherwise fall back to the build timestamp. The running app compares
// its own baked-in id against /version.json to detect new deployments.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  String(Date.now())

// Emits /version.json into the build output so clients can poll for updates.
function emitVersionFile(buildId) {
  return {
    name: 'emit-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: buildId }),
      })
    },
  }
}

// Emits /sitemap.xml (public, crawlable routes only) and /robots.txt.
// Private/authenticated areas are intentionally excluded and disallowed.
function emitSeoFiles() {
  return {
    name: 'emit-seo-files',
    generateBundle() {
      const today = new Date().toISOString().split('T')[0]

      const staticRoutes = [
        { loc: '/', changefreq: 'daily', priority: '1.0' },
        { loc: '/doctors', changefreq: 'daily', priority: '0.9' },
        { loc: '/collaborate', changefreq: 'monthly', priority: '0.6' },
        { loc: '/register', changefreq: 'monthly', priority: '0.5' },
        { loc: '/login', changefreq: 'monthly', priority: '0.3' },
        { loc: '/terms-of-service', changefreq: 'yearly', priority: '0.2' },
        { loc: '/privacy-policy', changefreq: 'yearly', priority: '0.2' },
      ]
      const specRoutes = SPECIALIZATIONS.map(s => ({
        loc: `/specializations/${s.slug}`, changefreq: 'weekly', priority: '0.7',
      }))
      const urls = [...staticRoutes, ...specRoutes]

      const body = urls.map(u => (
        `  <url>\n` +
        `    <loc>${SITE_URL}${u.loc}</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>${u.changefreq}</changefreq>\n` +
        `    <priority>${u.priority}</priority>\n` +
        `  </url>`
      )).join('\n')

      const sitemap =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })

      const robots =
        `# MediBook robots.txt\n` +
        `User-agent: *\n` +
        `Allow: /\n` +
        // Keep private / authenticated areas out of search indexes.
        `Disallow: /admin\n` +
        `Disallow: /doctor\n` +
        `Disallow: /hospital\n` +
        `Disallow: /patient\n` +
        `Disallow: /onboarding\n` +
        `Disallow: /mfa\n` +
        `Disallow: /security\n` +
        `Disallow: /notifications\n` +
        `Disallow: /complaints\n` +
        `Disallow: /collaborate/status\n\n` +
        `Sitemap: ${SITE_URL}/sitemap.xml\n`
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
    },
  }
}

export default defineConfig({
  plugins: [react(), emitVersionFile(BUILD_ID), emitSeoFiles()],
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 5173,
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/services/**', 'src/security/**'],
    },
  },
})
