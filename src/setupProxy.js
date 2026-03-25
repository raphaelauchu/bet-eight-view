const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/nhl-api',
    createProxyMiddleware({
      target: 'https://api-web.nhle.com',
      changeOrigin: true,
      secure: false,
      pathRewrite: {
        '^/nhl-api': '/v1',
      },
      on: {
        error: (err, req, res) => {
          console.error('Proxy error:', err);
        },
      },
    })
  );
};