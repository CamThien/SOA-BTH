const express = require('express');
const authRoutes = require('./routes/auth.routes');

const app = express();
app.use(express.json());

// Gắn Router vào ứng dụng
app.use('/', authRoutes);

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Server SOA đang chạy tại: http://localhost:${port}`);
});