import expect from 'expect';
import { spy, stub, match } from 'sinon';
import proxyquire from 'proxyquire';
import {
  logout,
  errorHandler
} from '../../../../../src/server/handlers/login.js';

describe('login', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      session: {
        destroy: stub().callsArg(0)
      },
      body: {
        'openid.response_nonce': '2016-11-15T10:05:11ZYDVKpj'
      }
    };
    res = {
      send: spy(),
      redirect: spy()
    };
    next = spy();
  });

  describe('logout handler', () => {

    it('destroys session', () => {
      logout(req, res, next);
      expect(req.session.destroy.calledOnce).toBe(true);
    });

    it('on success redirects to home', () => {
      req.session.destroy.callsArgWith(0, false);
      logout(req, res, next);
      expect(res.redirect.calledWith('/')).toBe(true);
    });

    it('on error calls next with error', () => {
      req.session.destroy.callsArgWith(0, true);
      logout(req, res, next);
      expect(next.calledWith(new Error())).toBe(true);
    });

  });

  describe('error handler', () => {

    it('should put error message on session error prop', () => {
      const message = 'abcdef';
      errorHandler(new Error(message), req, res, next);
      expect(req.session.error).toBe(message);
    });

  });

  describe('nonce checker handler', () => {
    let memcachedNonceChecker;

    context('when Memcached service is available', () => {
      let add;
      context('and nonce exists', () => {

        beforeEach(() => {
          add = stub().callsArgWith(3, true);
          memcachedNonceChecker = proxyquireHelper({
            'memcached': memcachedMockHelper(add),
            '../configure.js': {
              get: stub().withArgs('SESSION_MEMCACHED_HOST').returns('127.0.0.1:11211')
            }
          });
          memcachedNonceChecker(req, res, next);
        });

        it('should add nonce to Memcached storage with 5 minutes lifetime', () => {
          expect(add.calledWith(
            'OPENID_NONCE:11ZYDVKpj',
            '2016-11-15T10:05:11ZYDVKpj',
            5 * 60,
            match.func
          )).toBe(true);
        });

        it('should call next middleware with an error', () => {
          expect(next.calledWith(match.instanceOf(Error))).toBe(true);
        });
      });

      context('and nonce does not exist', () => {
        beforeEach(() => {
          add = stub().callsArgWith(3, false);
          memcachedNonceChecker = proxyquireHelper({
            'memcached': memcachedMockHelper(add),
            '../configure.js': {
              get: stub().withArgs('SESSION_MEMCACHED_HOST').returns('127.0.0.1:11211')
            }
          });
          memcachedNonceChecker(req, res, next);
        });

        it('should add nonce to Memcached storage with 5 minutes lifetime', () => {
          expect(add.calledWith(
            'OPENID_NONCE:11ZYDVKpj',
            '2016-11-15T10:05:11ZYDVKpj',
            5 * 60,
            match.func
          )).toBe(true);
        });

        it('should call next middleware with no error', () => {
          expect(next.calledWithExactly()).toBe(true);
        });
      });

    });

    context('when Memcached service is not available', () => {
      beforeEach(() => {
        memcachedNonceChecker = proxyquireHelper({
          '../configure.js': {
            get: stub().withArgs('SESSION_MEMCACHED_HOST').returns(null)
          }
        });
        memcachedNonceChecker(req, res, next);
      });

      it('should call next middleware with no error', () => {
        expect(next.calledWithExactly()).toBe(true);
      });
    });
  });
});

function memcachedMockHelper(addStub) {
  return function () {
    this.add = addStub;
  };
}

function proxyquireHelper(options) {
  return proxyquire(
    '../../../../../src/server/handlers/login.js',
    options
  ).memcachedNonceChecker;
}
