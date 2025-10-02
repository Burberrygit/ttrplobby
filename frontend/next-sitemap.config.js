/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.ttrplobby.com',
  generateRobotsTxt: true,   // also creates /robots.txt
  sitemapSize: 7000,

  // IMPORTANT: run inside `frontend/`, so look for .next/ here:
  sourceDir: '.',            // or just remove this line entirely
  outDir: 'public',          // write sitemap.xml into frontend/public

  // keep it minimal; exclude APIs from indexing
  exclude: ['/api/*'],
};
