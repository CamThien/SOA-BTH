const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');
const verifyTokenMiddleware = require('../middlewares/auth.middleware');

// 1. Dịch vụ đăng nhập: POST /
router.post('/', AuthController.login);

// 2. Dịch vụ xác thực token: GET /auth
router.get('/auth', verifyTokenMiddleware, AuthController.verify);

// 3. API "Hello World" bài 1 có áp dụng Middleware xác thực token
router.get('/hello', verifyTokenMiddleware, AuthController.helloWorld);

module.exports = router;