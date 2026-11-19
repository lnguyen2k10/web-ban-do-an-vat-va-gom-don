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

Dữ liệu được lưu phía máy chủ bằng SQLite tại `DB_PATH`, mặc định là `data/shop.sqlite`. Đặt tệp này trên ổ đĩa bền vững nếu chạy trên máy chủ và sao lưu bằng công cụ backup của SQLite. Bản đầu dùng một máy chủ Node với ổ đĩa cục bộ. Supabase chưa được kết nối. Để chạy trên Supabase cần thêm lớp lưu trữ Postgres, chuyển dữ liệu và kiểm thử lại. Khi triển khai, dùng HTTPS, đặt `PUBLIC_URL` thành tên miền chính thức và `COOKIE_SECURE=1`.

## Vận hành

1. Vào **Cụm giao**, cập nhật phạm vi, điểm tập kết, phí và link Zalo. Mỗi cụm có link đặt và QR SVG riêng. Với chung cư mới, tạo cụm mới và in QR từ tên miền chính thức.
2. Vào **Nhà cung cấp** và **Sản phẩm** để thay bộ mẫu. Giá vốn lưu cùng dòng hàng khi tạo đơn. Khi nhập Excel, lấy mã nhà cung cấp từ trang quản trị. Cột ảnh nhận URL HTTPS hoặc đường dẫn ảnh mẫu trong kho mã. Trang sửa món nhận tối đa 3 ảnh JPG, PNG hoặc WebP, mỗi ảnh tải lên tối đa 650 KB.
3. Đơn web tách theo lịch bán. Đồ ăn vặt nhận trước 17h mỗi ngày. Đơn gom mở từ thứ Hai đến trước 17h thứ Năm, xếp giao thứ Bảy hoặc Chủ nhật theo giờ Việt Nam. Nút **Nhập đơn Zalo** cho phép admin ghi đơn thủ công ngoài giờ.
4. Sau khi đóng đợt, vào **Gom hàng**, chọn ngày thứ Bảy của đợt rồi xem số lượng từ các đơn đã xác nhận. Chọn nhà cung cấp và cụm để lập phiếu. Có thể nhập một điểm nhận chung cho cả phiếu. Xem nội dung trong phiếu để gửi nhà cung cấp. Khi hàng về, ghi số thực nhận và tổng đã trả.
5. **Quản trị** có toàn quyền, **Soạn hàng** xem các đơn đã xác nhận và cập nhật bước soạn, **Giao hàng** xem đơn được giao việc và báo kết quả. Quản trị xếp lịch, phân người giao, ghi thực thu và mức cọc từng đơn gom.
6. **Báo cáo** ghi nhận doanh thu, giá vốn và chi phí trực tiếp theo ngày hoàn thành giao. Tiền thực thu theo ngày ghi nhận thanh toán, kể cả cọc trước ngày giao. Chi phí chung theo ngày phát sinh. Lãi bằng doanh thu trừ giá vốn và chi phí.

Bot Telegram tự gửi tóm tắt cho đơn web nếu có `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID`. Nếu Telegram lỗi, đơn vẫn lưu và hiển thị trong quản trị. Cấu hình Twilio Verify bằng ba biến `TWILIO_*` để bật tra lịch sử bằng SMS. Link tra riêng tạo ngay lúc đặt. Các cấu hình bí mật nằm trong `.env` hoặc trình quản lý biến môi trường của máy chủ.

Ảnh và giá trong danh mục là dữ liệu minh họa. Các link Zalo, phí giao và địa chỉ tập kết có thể điền khi chốt thông tin thật.
