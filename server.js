const express = require('express');
const authRoutes = require('./routes/auth.routes');

const app = express();
app.use(express.json());

// Gắn Router vào ứng dụng
app.use('/', authRoutes);

app.listen(3000, () => {
  console.log('Server SOA đang chạy tại: http://localhost:3000');
});