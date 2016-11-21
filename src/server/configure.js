const path = require('path');
const nconf = require('nconf');

nconf.argv();

let envFile = 'environments/development.env';

if (nconf.get('env')) {
  envFile = path.resolve(__dirname, '../..', nconf.get('env'));
}

require('dotenv').config({ path: envFile });

nconf.env({
  separator: '__'
});

module.exports = nconf;
