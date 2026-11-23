# Lee’s Shop

Cửa hàng tiếng Việt cho đồ ăn vặt giao trong ngày và đồ khô, món gom giao cuối tuần. Hai cụm ban đầu là Nguyễn Gia Trí · Bình Thạnh và Quận 1 – Quận 3.

## Chạy bản đầu

Yêu cầu Node.js 24 trở lên.

```sh
npm ci
cp .env.example .env
```

Điền `ADMIN_PASSWORD` (tối thiểu 12 ký tự) vào `.env`. Tài khoản được tạo ở lần khởi động đầu tiên. Sau khi tài khoản đã tạo, bỏ mật khẩu khỏi biến môi trường. Chạy:

```sh
npm start
```

- `http://localhost:3000/` là cửa hàng.
- `http://localhost:3000/admin` là trang quản trị.
- `http://localhost:3000/tra-don` là trang tra cứu.
- `npm test` chạy kiểm thử.

## Cơ sở dữ liệu

- Chạy thử cục bộ dùng SQLite tại `DB_PATH`, mặc định `data/shop.sqlite`.
- Khi đặt `DATABASE_URL` hoặc `SUPABASE_DB_URL`, ứng dụng dùng PostgreSQL. Đặt thêm `DB_ENGINE=postgres` để báo lỗi ngay nếu thiếu URL. Sử dụng **Transaction pooler** của Supabase cho Vercel. Kết nối từ xa xác thực chứng chỉ TLS. Có thể cung cấp CA bằng `DATABASE_SSL_CA` nếu cần.
- Mã khởi tạo nằm tại [db/postgres.sql](db/postgres.sql). Ứng dụng có thể khởi tạo schema với tài khoản có quyền DDL. Trên Vercel, tạo schema bằng tài khoản quản trị trước và đặt `DB_SKIP_MIGRATIONS=1` để ứng dụng chạy bằng tài khoản chỉ có quyền đọc/ghi trong schema riêng `lees_shop`.
- PostgreSQL lưu dữ liệu cửa hàng, phiên đăng nhập, khóa chống trùng đơn và hàng đợi thông báo. Dữ liệu SQLite hiện có không tự chuyển sang PostgreSQL.
- Kiểm thử PostgreSQL bằng `TEST_DATABASE_URL=... npm test` với một database thử nghiệm trống.

## Vercel

Repo có cấu hình phục vụ trang tĩnh và Node API trên Vercel. Khai báo `DATABASE_URL` (Sensitive), `DB_ENGINE=postgres`, `DB_SKIP_MIGRATIONS=1`, `COOKIE_SECURE=1` và `ADMIN_PASSWORD` trong môi trường Production. Khi đã đăng nhập quản trị thành công, có thể bỏ `ADMIN_PASSWORD` khỏi Vercel. Đặt `PUBLIC_URL` thành tên miền chính thức để dùng trong QR và thông báo. Telegram cần cả `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID`.

## Vận hành

1. Vào **Cụm giao**, cập nhật phạm vi, điểm tập kết, phí và link Zalo. Mỗi cụm có link đặt và QR SVG riêng. Với chung cư mới, tạo cụm mới và in QR từ tên miền chính thức.
2. Vào **Nhà cung cấp** và **Sản phẩm** để thay bộ mẫu. Giá vốn lưu cùng dòng hàng khi tạo đơn. Khi nhập Excel, lấy mã nhà cung cấp từ trang quản trị. Cột ảnh nhận URL HTTPS hoặc đường dẫn ảnh mẫu trong kho mã. Trang sửa món nhận tối đa 5 ảnh JPG, PNG hoặc WebP, mỗi ảnh chọn từ thiết bị tối đa 20 MB và được nén tự động. Có thể thêm link video YouTube.
3. Đơn web tách theo lịch bán. Đồ ăn vặt nhận trước 17h mỗi ngày. Đơn gom mở từ thứ Hai đến trước 17h thứ Năm, xếp giao thứ Bảy hoặc Chủ nhật theo giờ Việt Nam. Nút **Nhập đơn Zalo** cho phép admin ghi đơn thủ công ngoài giờ.
4. Sau khi đóng đợt, vào **Gom hàng**, chọn ngày thứ Bảy của đợt rồi xem số lượng từ các đơn đã xác nhận. Chọn nhà cung cấp và cụm để lập phiếu. Có thể nhập một điểm nhận chung cho cả phiếu. Xem nội dung trong phiếu để gửi nhà cung cấp. Khi hàng về, ghi số thực nhận và tổng đã trả.
5. **Quản trị** có toàn quyền, **Soạn hàng** xem các đơn đã xác nhận và cập nhật bước soạn, **Giao hàng** xem đơn được giao việc và báo kết quả. Quản trị xếp lịch, phân người giao, ghi thực thu và mức cọc từng đơn gom.
6. **Báo cáo** ghi nhận doanh thu, giá vốn và chi phí trực tiếp theo ngày hoàn thành giao. Tiền thực thu theo ngày ghi nhận thanh toán, kể cả cọc trước ngày giao. Chi phí chung theo ngày phát sinh. Lãi bằng doanh thu trừ giá vốn và chi phí.

Bot Telegram tự gửi tóm tắt cho đơn web nếu có `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID`. Nếu Telegram lỗi, đơn vẫn lưu và hiển thị trong quản trị. Link tra riêng tạo ngay lúc đặt. Khách dùng link này để xem trạng thái đơn. Trình duyệt cũng lưu các link gần đây trên cùng thiết bị. Quản trị xem lịch sử khách theo số điện thoại. Các cấu hình bí mật nằm trong `.env` hoặc trình quản lý biến môi trường của máy chủ.

Ảnh và giá trong danh mục là dữ liệu minh họa. Các link Zalo, phí giao và địa chỉ tập kết có thể điền khi chốt thông tin thật.
