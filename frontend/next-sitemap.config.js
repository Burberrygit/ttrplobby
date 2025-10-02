const path = require('path');

module.exports = {
  siteUrl: 'https://www.ttrplobby.com',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  outDir: path.resolve(__dirname, 'public'),
  buildManifestFile: path.resolve(__dirname, '.next', 'build-manifest.json'),

  exclude: ['/api/*'],

  // NEW: point robots.txt at your dynamic sitemap too
  robotsTxtOptions: {
    additionalSitemaps: [
      'https://www.ttrplobby.com/server-sitemap.xml',
    ],
  },
}
