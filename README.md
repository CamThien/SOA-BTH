# Bài thực hành 3 và 4 — SOA

Ba service chạy độc lập:

| Service | URL | Database |
| --- | --- | --- |
| Xác thực bài 2 | http://localhost:3000 | Dữ liệu người dùng có sẵn trong `models/user.model.js` |
| Sản phẩm bài 3 | http://localhost:3001/products | `product_db` |
| Đơn hàng bài 4 | http://localhost:3002/orders | `order_db` |

## Chuẩn bị

Môi trường đã kiểm tra: Node.js 24, SQL Server trên localhost:1433.
Nếu cần cài lại thư viện, chạy `npm.cmd install` ở thư mục gốc và ở từng thư mục service.

Mặc định SQL Server dùng tài khoản `sa`, mật khẩu `123456`, giống cấu hình ban đầu.
Có thể cấu hình bằng biến môi trường PowerShell (đặt trong mỗi terminal cần sử dụng):

```powershell
$env:DB_HOST = 'localhost'
$env:DB_PORT = '1433'
$env:DB_USER = 'sa'
$env:DB_PASSWORD = 'mat-khau-cua-ban'
```

Chạy tại thư mục gốc để tạo database và các bảng chưa tồn tại, giữ nguyên bảng đã có:

```powershell
node setup-databases.cjs
npm.cmd run build --prefix product-management-service
npm.cmd run build --prefix order-management-service
```

Cũng có thể mở `setup-databases.sql` trong SQL Server Management Studio và thực thi.
Script không tự thay đổi cấu trúc bảng đã tồn tại.

## Chạy

Mở ba terminal tại thư mục gốc, mỗi terminal chạy một lệnh:

```powershell
npm.cmd start
```

```powershell
npm.cmd run start:prod --prefix product-management-service
```

```powershell
npm.cmd run start:prod --prefix order-management-service
```

Sau khi sửa mã nguồn, build lại hoặc dùng `start:dev` thay cho `start:prod`.
Dùng `npm.cmd` trên PowerShell để tránh lỗi chặn thực thi `npm.ps1`.
Cổng có thể đổi qua biến `PORT`. URL liên service có thể đổi qua `AUTH_SERVICE_URL` và `PRODUCT_SERVICE_URL`.

## Thử bằng Postman

1. `POST http://localhost:3000/`, chọn Body → raw → JSON:

```json
{
  "userName": "admin",
  "password": "e10adc3949ba59abbe56e057f20f883e"
}
```

Mật khẩu gửi lên là MD5 của `123456`, theo service bài 2 hiện có.
Lấy trường `token` trong kết quả. Với mọi request sản phẩm, đơn hàng và chi tiết,
chọn Authorization → Bearer Token và dán token này.

2. `POST http://localhost:3001/products`:

```json
{
  "name": "Ban phim",
  "description": "Ban phim USB",
  "price": 250000,
  "quantity": 20
}
```

3. `POST http://localhost:3002/orders`, thay `product_id` bằng ID nhận ở bước 2:

```json
{
  "customer_name": "Nguyen Van A",
  "customer_email": "a@example.com",
  "items": [
    { "product_id": 1, "quantity": 2 }
  ]
}
```

Đơn được tạo ở trạng thái `pending`. Service lấy tên, giá và tồn kho từ API sản phẩm,
gộp sản phẩm trùng ID trong request, tự tính thành tiền và tổng tiền. Đơn và chi tiết được
lưu trong một transaction. Không nhận giá do client quyết định.

4. `PUT http://localhost:3002/orders/ID`:

```json
{ "status": "completed" }
```

Các trạng thái hợp lệ: `pending`, `completed`, `cancelled`. Đơn đã hoàn tất hoặc hủy
không được sửa trạng thái sang trạng thái khác; chỉ đơn `pending` được sửa chi tiết.

## API

| Resource | Danh sách | Chi tiết | Tạo | Sửa | Xóa |
| --- | --- | --- | --- | --- | --- |
| Sản phẩm, cổng 3001 | GET /products | GET /products/:id | POST /products | PUT /products/:id | DELETE /products/:id |
| Đơn hàng, cổng 3002 | GET /orders | GET /orders/:id | POST /orders | PUT /orders/:id | DELETE /orders/:id |
| Chi tiết, cổng 3002 | GET /order_items | GET /order_items/:id | POST /order_items | PUT /order_items/:id | DELETE /order_items/:id |

Body tạo chi tiết: `{ "order_id": 1, "product_id": 1, "quantity": 2 }`.
Body cập nhật chi tiết có thể chỉ gồm `{ "quantity": 3 }`.
Không chuyển chi tiết sang đơn khác. Sửa/xóa chi tiết tự cập nhật tổng tiền đơn.
Xóa đơn tự xóa chi tiết trước để giữ đúng khóa ngoại.
Không tồn tại trả 404; dữ liệu không hợp lệ hoặc thiếu tồn kho trả 400;
token thiếu/sai trả 401; service xác thực/sản phẩm không kết nối được trả 503.

Tên bảng thống nhất là `order_items` (phụ lục ghi `other_items` nhưng API dùng `order_items`).
SQL Server dùng `datetime2` cho ngày tạo/cập nhật vì kiểu `timestamp` của SQL Server là rowversion.

Phạm vi tồn kho theo đề: kiểm tra số lượng hiện tại khi tạo/sửa chi tiết, chưa đặt giữ hoặc trừ kho.
Vì vậy các đơn khác nhau có thể cùng vượt tổng tồn kho nếu cần triển khai quy trình giữ hàng thực tế.
Hai service không truy vấn trực tiếp database của nhau.

## Kiểm tra

```powershell
npm.cmd test --prefix product-management-service -- --runInBand
npm.cmd test --prefix order-management-service
node scripts/integration.cjs
```

Integration test cần hai database đã khởi tạo, tự khởi động ba service ở các cổng
3300–3302, thử đăng nhập và CRUD thật với SQL Server, kiểm tra lỗi token/tồn kho,
giá và tổng tiền. Nó xóa dữ liệu sản phẩm/đơn thử nghiệm và dừng các process do nó tạo.
