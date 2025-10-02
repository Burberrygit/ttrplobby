// frontend/next-sitemap.config.js
const path = require('path');

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.ttrplobby.com',
  generateRobotsTxt: true,
  sitemapSize: 7000,

  // Make paths absolute to avoid CWD/monorepo quirks
  outDir: path.resolve(__dirname, 'public'),
  buildManifestFile: path.resolve(__dirname, '.next', 'build-manifest.json'),

  exclude: ['/api/*'],
};
