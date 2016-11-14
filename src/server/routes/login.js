import { Router } from 'express';
import bodyParser from 'body-parser';
import {
  getMacaroon,
  authenticate,
  verify,
  logout,
  errorHandler,
  memcachedNonceChecker
} from '../handlers/login.js';

const router = Router();

router.get('/login/authenticate', getMacaroon, authenticate);
router.get('/login/verify', verify);
router.use(bodyParser.urlencoded({ extended: true }));
router.post('/login/verify', memcachedNonceChecker);
router.post('/login/verify', verify);
router.get('/logout', logout);
router.use(errorHandler);

export default router;
