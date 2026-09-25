// Mô phỏng Bảng người dùng (User) theo phụ lục đề bài
// Password là chuỗi MD5 của '123456'
const users = [
  {
    IdUser: 1,
    UserName: "admin",
    Password: "e10adc3949ba59abbe56e057f20f883e", // Đã mã hoá tại Client
    Token: null
  }
];

module.exports = users;