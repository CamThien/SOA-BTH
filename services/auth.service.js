const jwt = require('jsonwebtoken');
const users = require('../models/user.model');

const JWT_SECRET = 'BiMatKhongDuocTietLo123';

class AuthService {
  // Dịch vụ kiểm tra đăng nhập & sinh JWT Token
  static login(userName, password) {
    const user = users.find(u => u.UserName === userName && u.Password === password);
    if (!user) {
      throw new Error('Tài khoản hoặc mật khẩu không chính xác.');
    }

    const token = jwt.sign(
      { id: user.IdUser, userName: user.UserName },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Lưu token vào Bảng User
    user.Token = token;

    return token;
  }

  // Dịch vụ xác thực Token
  static verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }
}

module.exports = AuthService;