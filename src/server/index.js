const url = require('url');
const util = require('util');
const conf = require('./configure.js');
let baseUrl = '';

if (process.env.NODE_ENV != 'production') {
  require('babel-register');
  baseUrl = conf.get('SERVER:WEBPACK_DEV_URL') || '';
}

require('css-modules-require-hook/preset');
require('images-require-hook')('.svg', `${baseUrl}/static/icons`);

const app = require('./server').default;
const appUrl = url.parse(conf.get('UNIVERSAL:MU_URL'));
const appHost = conf.get('SERVER:HOST') || appUrl.hostname;
const appPort = conf.get('SERVER:PORT') || appUrl.port;

const server = app.listen(appPort, appHost, () => {
  const host = server.address().address;
  const port = server.address().port;

  util.log('🚂  Express server listening on http://%s:%s 🚂', host, port);
});
