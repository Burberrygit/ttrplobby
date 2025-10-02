/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.ttrplobby.com',
  generateRobotsTxt: true,
  sitemapSize: 7000,

  // Run from inside `frontend/`
  outDir: 'public',
  buildManifestFile: './.next/build-manifest.json', // <-- leading ./ matters in some shells

  exclude: ['/api/*']
}
