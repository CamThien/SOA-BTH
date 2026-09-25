const AuthService = require('../services/auth.service');

class AuthController {
  // Xử lý Request Đăng nhập
  static login(req, res) {
    try {
      const { userName, password } = req.body;
      const token = AuthService.login(userName, password);
      return res.status(200).json({
        message: 'Đăng nhập thành công!',
        token: token
      });
    } catch (error) {
      return res.status(401).json({ message: error.message });
    }
  }

  // Xử lý Request Xác thực Token
  static verify(req, res) {
    return res.status(200).json({
      message: 'Token hợp lệ!',
      userData: req.user
    });
  }

  // Xử lý Request Hello World (Bài 1)
  static helloWorld(req, res) {
    return res.status(200).json({ message: 'Hello World' });
  }
}

module.exports = AuthController;