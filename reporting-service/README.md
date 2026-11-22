# Bài thực hành 5 — Reporting

Service chạy tại `http://localhost:3003`, database SQL Server riêng `reporting_db`.
Xác thực bằng API `GET /auth` của bài 2. Dữ liệu sản phẩm và đơn hàng được lấy
qua HTTP từ bài 3, bài 4; service không đọc database của hai bài đó.

## Quy tắc tính đã thống nhất

- Chỉ đơn `completed` được tính là đã bán. Đơn `pending` hoặc `cancelled` trả lỗi 400.
- Giá bán lấy từ `unit_price`/`total_price` trong chi tiết đơn bài 4, không lấy giá bán hiện tại.
- Vì bài 3, bài 4 chưa lưu giá nhập, khi tạo báo cáo phải cung cấp `costs`:
  giá nhập một đơn vị (`unit_cost`) của **tất cả sản phẩm trong đơn**.
  Không tự điền chi phí bằng 0 hoặc dùng giá bán làm giá nhập.
- `total_sold` = tổng số lượng của sản phẩm trong đơn, kể cả khi có nhiều dòng cùng sản phẩm.
- `revenue` = tổng thành tiền bán; `cost` = số lượng × giá nhập; `profit` = doanh thu − chi phí.
  Báo cáo đơn là tổng các sản phẩm trong đơn. Cho phép lợi nhuận âm.
- Tiền được tính theo số nguyên đơn vị nhỏ nhất (1/100), kiểm tra đúng giới hạn DECIMAL(10,2).
- `stock_quantity` là tồn kho **hiện tại do service sản phẩm trả về**. Đây là dữ liệu bổ sung
  trong phản hồi, không thêm cột vào hai bảng phụ lục. Không tự trừ tiếp số đã bán khỏi tồn kho.
  Nếu sản phẩm đã bị xóa, tên và tồn kho trả `null`, số liệu báo cáo đã lưu vẫn giữ nguyên.
- Báo cáo lưu là ảnh chụp số liệu lúc tạo. Xóa báo cáo sản phẩm không thay đổi tổng của báo cáo đơn
  đã lưu; xóa báo cáo đơn sẽ xóa các báo cáo sản phẩm liên kết bằng khóa ngoại.

## 1. Cấu hình SQL

Mở file `D:\SOA-BTH-work\reporting-service\.env`, điền mật khẩu `sa` thật vào dòng:

```dotenv
DB_PASSWORD="mat-khau-sa-cua-ban"
```

Thay nội dung trong dấu ngoặc kép bằng mật khẩu thật. Dùng dấu ngoặc kép nếu mật khẩu có dấu `#`.
File `.env` đã được git bỏ qua. Mẫu cấu hình có trong `.env.example`.
Nếu server/cổng khác `localhost:1433`, sửa `DB_HOST`, `DB_PORT` tương ứng.

Không bắt buộc dùng `.env`; cũng có thể đặt biến môi trường PowerShell:

```powershell
$env:DB_PASSWORD = 'mat-khau-sa-cua-ban'
```

Biến môi trường có ưu tiên cao hơn file `.env`. Mật khẩu đăng nhập SSMS và mật khẩu
service dùng phải cùng là mật khẩu của tài khoản `sa` trên server đó.

## 2. Tạo database và chạy bài 5

Mở PowerShell:

```powershell
cd D:\SOA-BTH-work\reporting-service
npm.cmd run db:setup
npm.cmd run build
npm.cmd run start:prod
```

`db:setup` chỉ tạo `reporting_db` và hai bảng báo cáo nếu chưa có, không thêm dữ liệu kinh doanh.
Giữ terminal mở. Nếu cần cài lại thư viện: `npm.cmd ci` trước khi build.

Cũng có thể tạo database bằng SSMS thay cho lệnh `db:setup`: đăng nhập SQL Server,
mở New Query và chạy:

```sql
IF DB_ID('reporting_db') IS NULL CREATE DATABASE reporting_db;
GO
USE reporting_db;
GO
```

Sau đó mở `scripts/schema.sql`, chọn database `reporting_db` trong thanh công cụ SSMS
và Execute để tạo bảng. Dù tạo database bằng cách nào, service vẫn cần mật khẩu
qua `.env` hoặc biến môi trường để kết nối SQL khi chạy.

Ba service bài cũ cũng cần đang chạy để xác thực và lấy dữ liệu:

Terminal xác thực:

```powershell
cd D:\SOA-BTH-work
npm.cmd start
```

Terminal sản phẩm:

```powershell
cd D:\SOA-BTH-work
$env:DB_PASSWORD = 'mat-khau-sa-cua-ban'
npm.cmd run start:prod --prefix product-management-service
```

Terminal đơn hàng:

```powershell
cd D:\SOA-BTH-work
$env:DB_PASSWORD = 'mat-khau-sa-cua-ban'
npm.cmd run start:prod --prefix order-management-service
```

Nếu service bài cũ đang chạy thì không cần chạy thêm. Không đặt `DB_NAME=reporting_db`
cho terminal của bài 3 hoặc bài 4; mỗi service phải giữ database riêng.

## 3. Thử bằng Postman

Có thể import `postman/BTH5.postman_collection.json` và đặt các biến trong collection.

1. Đăng nhập: `POST http://localhost:3000/`, Body → raw → JSON:

```json
{
  "userName": "admin",
  "password": "e10adc3949ba59abbe56e057f20f883e"
}
```

Copy `token` trả về. Với mọi request dưới đây, chọn Authorization → Bearer Token và dán token.

2. Xem `GET http://localhost:3002/orders`, chọn một đơn đã có trạng thái `completed`.
   Xem chi tiết bằng `GET http://localhost:3002/orders/ID_DON` để biết `product_id` và số lượng.
   Nếu chưa có đơn hoàn tất, bạn cần tạo/hoàn tất đơn thật qua API bài 4 trước.

3. Tạo báo cáo đơn: `POST http://localhost:3003/reports/orders`.
   Ví dụ JSON dưới đây chỉ minh họa định dạng: **thay ID và giá nhập bằng dữ liệu thật của bạn**:

```json
{
  "order_id": 1,
  "costs": [
    { "product_id": 1, "unit_cost": 150000 }
  ]
}
```

Nếu đơn có nhiều sản phẩm khác nhau, thêm đầy đủ từng sản phẩm vào `costs`.
Không gửi giá bán, doanh thu hoặc lợi nhuận; hệ thống tự tính từ đơn thật.
Ghi nhớ trường `id` trong kết quả — đây là **ID báo cáo đơn**, có thể khác ID đơn hàng.

4. Tạo báo cáo sản phẩm: `POST http://localhost:3003/reports/products`:

```json
{
  "order_report_id": 1,
  "product_id": 1,
  "costs": [
    { "product_id": 1, "unit_cost": 150000 }
  ]
}
```

`order_report_id` là ID nhận ở bước 3; `product_id` là sản phẩm muốn báo cáo.
Gửi lại **cùng danh sách `costs` của bước 3**, kể cả khi đơn có nhiều sản phẩm.
Hệ thống đối chiếu tổng với báo cáo đơn, tránh tạo chi tiết sai chi phí.
Một sản phẩm có tối đa một báo cáo trong cùng báo cáo đơn; gửi trùng trả 409.
Muốn báo cáo thêm sản phẩm khác, gửi request bước 4 với `product_id` khác trong đơn.

5. Xem/xóa theo bảng API bên dưới. `:id` là ID của bản ghi **báo cáo**, không phải ID sản phẩm/đơn gốc.

## API theo đề

| Phương thức | Đường dẫn | Chức năng |
| --- | --- | --- |
| GET | /reports/products | Danh sách báo cáo sản phẩm, kèm tồn kho hiện tại |
| GET | /reports/products/:id | Chi tiết một báo cáo sản phẩm |
| GET | /reports/orders | Danh sách báo cáo đơn |
| GET | /reports/orders/:id | Chi tiết một báo cáo đơn |
| POST | /reports/products | Tạo báo cáo sản phẩm, liên kết báo cáo đơn đã có |
| POST | /reports/orders | Tạo báo cáo tổng một đơn hoàn tất |
| DELETE | /reports/products/:id | Xóa một báo cáo sản phẩm |
| DELETE | /reports/orders/:id | Xóa báo cáo đơn và báo cáo sản phẩm liên kết |

Có thể lọc theo nguồn bằng `GET /reports/products?product_id=1`
hoặc `GET /reports/orders?order_id=1`.
Các báo cáo đơn được tạo ở các lần POST khác nhau là các bản ghi riêng; không cộng chồng
nhiều bản báo cáo của cùng một đơn để tính doanh thu.

Lỗi: 400 dữ liệu sai/thiếu giá nhập/đơn chưa hoàn tất; 401 token thiếu hoặc sai;
404 không tìm thấy; 409 báo cáo sản phẩm trùng hoặc chi phí không khớp;
502 dữ liệu nguồn không nhất quán; 503 service nguồn không truy cập được.

## Bảng SQL

`scripts/schema.sql` khai báo đúng hai bảng và các cột phụ lục:

- `orders_reports`: `id`, `order_id`, `total_revenue`, `total_cost`, `total_profit`.
- `product_reports`: `id`, `order_report_id`, `product_id`, `total_sold`, `revenue`, `cost`, `profit`.

Khóa ngoại chỉ giữa hai bảng trong `reporting_db`. ID sản phẩm/đơn là ID tham chiếu qua HTTP,
không tạo khóa ngoại xuyên database, không sửa bảng sản phẩm/đơn.

## Kiểm tra

```powershell
cd D:\SOA-BTH-work\reporting-service
npm.cmd test
```

Test dùng dữ liệu mô phỏng trong bộ nhớ và HTTP nội bộ, không kết nối SQL hoặc tạo
sản phẩm/đơn/báo cáo thử trong database thật. Kiểm tra cả 8 API, xác thực,
công thức tính tiền, trạng thái đơn, dữ liệu thiếu/sai, tồn kho, lỗi service nguồn,
chống trùng báo cáo sản phẩm và xóa liên kết.
