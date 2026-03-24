const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/nhl-api',
    createProxyMiddleware({
      target: 'https://api-web.nhle.com',
      changeOrigin: true,
      pathRewrite: {
        '^/nhl-api': '/v1',
      },
    })
  );
};