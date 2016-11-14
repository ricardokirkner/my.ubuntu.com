import request from 'request';
import { extractCaveatId, formatMacaroonAuthHeader } from '../macaroons';
import conf from '../configure.js';
import RelyingPartyFactory from '../openid/relyingparty.js';
import constants from '../constants';
import Memcached from 'memcached';
import util from 'util';

const UBUNTU_SCA_URL = conf.get('SERVER:UBUNTU_SCA_URL');
const OPENID_IDENTIFIER = conf.get('SERVER:UBUNTU_SSO_URL');
const OPENID_NONCE_NAMESPACE = 'OPENID_NONCE';

export const getMacaroon = (req, res, next) => {
  const options = {
    url: `${UBUNTU_SCA_URL}/dev/api/acl/`,
    method: 'POST',
    json: {
      'permissions': ['package_access', 'package_purchase']
    }
  };

  request(options, (error, response, body) => {
    if (error) {
      // TODO log errors to sentry
      return next(new Error(constants.E_GET_MACAROON_FAIL));
    }

    if (!body.macaroon) {
      // TODO log errors to sentry
      return next(new Error(constants.E_GET_MACAROON_UNDEF));
    }

    req.session.macaroon = body.macaroon;
    req.session.cid = extractCaveatId(body.macaroon);
    next();
  });
};

export const authenticate = (req, res, next) => {
  const rp = RelyingPartyFactory(req.session);

  // TODO log errors to sentry
  rp.authenticate(OPENID_IDENTIFIER, false, (error, authUrl) => {
    if (error) {
      return next(new Error(`${constants.E_AUTHENTICATION_FAIL}: ${error.message}`));
    }
    else if (!authUrl) {
      return next(new Error(constants.E_AUTHENTICATION_FAIL));
    }
    else {
      res.redirect(authUrl);
    }
  });

};

export const verify = (req, res, next) => {
  const rp = RelyingPartyFactory(req.session);
  rp.verifyAssertion(buildRequestString(req), (error, result) => {
    if (error) {
      // TODO log errors to sentry
      return next(error);
    }

    if (!result.authenticated) {
      return next(new Error(`${constants.E_SSO_FAIL}`));
    }

    if (!result.discharge) {
      return next(new Error(`${constants.E_SSO_DISCHARGE_FAIL}`));
    }

    if (!req.session) {
      return next(new Error(`${constants.E_NO_SESSION}`));
    }

    if (!req.session.macaroon) {
      return next(new Error(`${constants.E_NO_SESSION_MACAROON}`));
    }

    req.session.authenticated = result.authenticated;
    req.session.name = result.fullname;
    req.session.email = result.email;
    req.session.authorization = formatMacaroonAuthHeader(req.session.macaroon, result.discharge);
    // FIXME redirect to page that initiated the sign in request
    res.redirect('/');
  });
};

export const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      // TODO log errors to sentry
      return next(new Error(constants.E_LOGOUT_FAIL));
    }
    // FIXME redirect to page that initiated the sign in request
    res.redirect('/');
  });
};

export const errorHandler = (err, req, res, next) => {
  // https://expressjs.com/en/guide/error-handling.html#the-default-error-handler
  if (res.headersSent) {
    return next(err);
  }
  if (req.session) {
    req.session.error = err.message;
  }
  // FIXME redirect to page that initiated the sign in request
  res.redirect('/');
};

export const memcachedNonceChecker = (req, res, next) => {
  if (!conf.get('SESSION_MEMCACHED_HOST')) {
    return next();
  }

  const memcached = new Memcached(conf.get('SESSION_MEMCACHED_HOST'));
  const nonce = req.body['openid.response_nonce'];

  memcached.add(
    getNonceIdentifier(nonce),  // nonce identifier
    nonce,                      // nonce value
    5 * 60,                     // nonce lifetime (five minutes)
    (err) => {
      if (err) {
        util.log('Nonce replayed: ' + nonce);
        return next(new Error(`${constants.E_NONCE_REPLAYED}`));
      }

      util.log('Nonce okay: ' + nonce);
      next();
    }
  );
};

function buildRequestString(req) {
  var queryStringParts = [];
  for(var key in req.body) {
    if(req.body.hasOwnProperty(key)) {
      queryStringParts.push(key + '=' + encodeURIComponent(req.body[key]));
    }
  }

  return '?' + queryStringParts.join('&');
}

function getNonceIdentifier(nonce) {
  return OPENID_NONCE_NAMESPACE + ':' + nonce.split(':')[2];
}
