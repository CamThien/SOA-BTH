const AuthService = require('../services/auth.service');

const verifyTokenMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Thất bại: Không tìm thấy Token xác thực!' });
  }

  try {
    const decoded = AuthService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Thất bại: Token không hợp lệ hoặc đã hết hạn.' });
  }
};

module.exports = verifyTokenMiddleware;