/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.ttrplobby.com',
  generateRobotsTxt: true,          // also creates /robots.txt
  sitemapSize: 7000,
  // Because your Next.js app is in ./frontend
  sourceDir: 'frontend',            // where next.config.js and /src/app live
  outDir: 'frontend/public',        // write sitemap.xml into the app's public/
  exclude: [
    '/api/*',
    '/admin/*',
  ],
  // optional: add extra static URLs if needed
  additionalPaths: async (config) => {
    return [
      await config.transform(config, '/'),
      await config.transform(config, '/live'),
      await config.transform(config, '/profile'),
    ]
  },
}
