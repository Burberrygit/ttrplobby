/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.ttrplobby.com',
  generateRobotsTxt: true,
  sitemapSize: 7000,

  // You’re running next-sitemap from inside `frontend/`
  // so make the paths explicit and local to this folder:
  outDir: 'public',
  buildManifestFile: '.next/build-manifest.json', // <-- key fix
  // Optional: exclude API routes etc.
  exclude: ['/api/*'],
};
