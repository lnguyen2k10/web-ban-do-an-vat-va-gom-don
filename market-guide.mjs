const nep='https://nepxanh.com/vi-vn/';
const coop='https://cooponline.vn/';
const source=(name,price,url,note='')=>({name,price,url,note});
const n=(price,path,note)=>source('Nếp Xanh',price,nep+path,note);
const row=(group,name,unit,proposed,quotes,note='',sku='')=>({group,name,unit,proposed,quotes,note,sku});

export const marketGuide={
  observed:'2026-11-23',
  rows:[
    row('Hải sản','Mực nang ướp sa tế','500 g',195000,[n(237000,'muc-nang-uop-san-P00577-578.html','474.000 ₫/kg quy đổi, mực ướp sẵn khác công thức')],'Thử giá hiện tại theo cụm.','ZALO-MN-ST-500'),
    row('Thịt ướp sẵn','Ba rọi một nắng ướp tỏi ớt','500 g',160000,[source('Luxy',85000,'https://sieuthiluxy.vn/products/ba-roi-mot-nang-vi-0-5kg','Ướp sả ớt'),n(209000,'nac-vai-P00115-115.html','Chấm muối kiến vàng')],'Giá thử theo giá vốn hiện có. Ưu tiên hỏi lại giá nhập.','ZALO-BR-TO-500'),
    row('Đồ khô','Mực câu 4 nắng, 4–9 con/kg','500 g',645000,[source('Hải Sản Mỗi Ngày',390000,'https://haisanmoingay.com/san-pham/muc-deo-ba-nang/','Ba nắng, 8–10 con/kg; quy đổi từ 780.000 ₫/kg'),source('Hải Sản Ông Giàu',475000,'https://onggiau.com.vn/san-pham/muc-deo/','2–3 nắng, 4–6 con/kg; quy đổi từ 950.000 ₫/kg')],'Giá thử; chỉ gom nhỏ. Mốc tham chiếu khác số nắng.','ZALO-MC-4N-500'),
    row('Đồ nguội','Chả lụa','500 g',125000,[n(145000,'cha-lua-P0043-43.html')],'Giá thử nếu cùng chất lượng.','CLU'),
    row('Đồ nguội','Lạp xưởng','500 g',145000,[n(173000,'shop.html','Lạp xưởng 500 g; xác nhận loại tươi trước khi đối chiếu')],'Giá đang bán.','LXT'),
    row('Đồ nguội','Chả mực giã tay','250 g',159000,[n(165000,'cha-muc-gia-tay-P0065-65-P0065-93.html')],''),
    row('Đồ nguội','Chả cá biển miếng tròn','250 g',85000,[n(89000,'tom-bop-thien-nhien-P00635-635.html')],''),
    row('Đồ nguội','Xúc xích heo','500 g',149000,[n(155000,'shop.html','Dòng Xúc Xích Heo 500 g')],''),
    row('Hải sản','Tôm sú thiên nhiên','500 g',195000,[n(197500,'tom-su-thien-nhien-P00667-668.html')],'Xác nhận cỡ tôm.'),
    row('Hải sản','Tôm thẻ nguyên con','500 g',169000,[n(175000,'tom-the-P00256-257.html')],'Xác nhận cỡ và tỷ lệ mạ băng nếu cấp đông.'),
    row('Hải sản','Tôm thẻ lột vỏ','500 g',179000,[n(185000,'tom-the-lot-vo-P00554-555.html')],'So giá theo trọng lượng tịnh.'),
    row('Hải sản','Mực sữa Phú Quốc','500 g',185000,[n(190000,'muc-sua-P0031-31-P0031-101.html')],''),
    row('Hải sản','Mực ống lao Phú Quốc','500 g',229000,[n(240000,'muc-ong-lao-P0030-30-P0030-100.html')],''),
    row('Hải sản','Cua xay','500 g',79000,[n(84000,'cua-xay-P00129-129.html')],'So loại cua và thành phần.'),
    row('Đồ khô','Tôm thẻ biển phơi khô','200 g',189000,[n(195000,'tom-kho-P00374-374.html')],'So cỡ tôm và độ khô.'),
    row('Đồ khô','Khô cá chỉ vàng','500 g',149000,[source('Đặc Sản Thiên Nhiên',140000,'https://dacsanthiennhien.vn/kho-ca-chi-vang','Giá khuyến mãi'),source('Đặc Sản Nha Trang',160000,'https://dacsannhatrang.com.vn/san-pham/kho-ca-chi-vang-nha-trang-500g/')],''),
    row('Đồ khô','Khô cá dứa','250 g',145000,[n(150000,'kho-ca-dua-dong-goi-P0035-35-P0035-103.html')],''),
    row('Hạt điều','Hạt điều rang muối Bình Phước','500 g',139000,[source('D & C Cashew',145000,'https://hatdieubp.com/hat-dieu-rang-muoi-binh-phuoc-500g/','Giá khuyến mãi')],'So tỷ lệ hạt nguyên và cỡ hạt.'),
    row('Hạt điều','Hạt điều rang không muối','500 g',145000,[source('Hạt điều Phúc Thịnh',150000,'https://hatdieuphucthinh.com/san-pham.html','Dòng rang củi không muối 500 g')],''),
    row('Trái cây sấy','Xoài sấy dẻo','100 g',45000,[source('Co.op Select',38500,coop+'xoai-say-deo-coop-select-100g--s250101539'),source('AEON · Vinamit',50000,'https://aeoneshop.com/product/6006/vinamit-xoai-say-deo-100g','Giá ưu đãi quan sát được, thường 59.000 ₫')],''),
    row('Trái cây sấy','Mít sấy giòn','100 g',45000,[source('Co.op · Vinamit',46000,coop+'vinamit-brand.vinamit','Mít sấy Vinamit 100 g')],''),
    row('Trái cây sấy','Chuối sấy','100 g',25000,[source('Co.op · Vinamit',25300,coop+'vinamit-brand.vinamit','Chuối sấy Vinamit 100 g')],''),
    row('Trà','Trà lài Thái Nguyên','100 g',42000,[source('Co.op · Phúc Long',44500,coop+'phuc-long-brand.phuc-long','Trà lài Thái Nguyên gói 100 g')],''),
    row('Trà','Trà sen phổ thông','100 g',15000,[source('Satrafoods',15000,'https://satrafoods.com.vn/vn/san-pham/tra-sen-100g.html')],'Giá phần lẻ nhỏ; cân nhắc bán kèm hoặc combo.'),
    row('Ăn vặt','Bánh tráng trộn','1 phần',25000,[source('beFood · Chị Ba',25000,'https://food.be.com.vn/ho-chi-minh/banh-trang-tron-banh-trang-cuon-chi-ba-nguyen-gia-tri-146736','Menu gần cụm Nguyễn Gia Trí')],'So topping và lượng mỗi phần.'),
    row('Ăn vặt','Bánh tráng bơ','1 phần',25000,[source('The Chang',25000,'https://www.banhtrangthechang.vn/products/banh-trang-bo-sua-thanh-long','Bơ sữa thanh long, khác công thức')],'Giá thử theo phần hiện tại.','BTB'),
    row('Ăn vặt','Cơm cháy chà bông','100 g',32000,[source('Ăn Vặt Yum Yum',30000,'https://anvatyumyum.com/com-chay-cha-bong-gion-rum-dam-da/')],'Tùy độ dày lớp chà bông.','CCB'),
    row('Ăn vặt','Rau câu dừa đóng gói','1 kg',59000,[source('Co.op · New Choice',60500,coop+'c/rau-cau-thach','Rau câu New Choice dừa 1 kg')],'So cùng kiểu đóng gói.'),
    row('Ăn vặt','Thạch dừa đóng hũ','1 kg',35000,[source('Co.op · Foli',34200,coop+'c/rau-cau-thach','Thạch dừa Foli hũ 1 kg')],''),
    row('Rượu','Vang đỏ Đà Lạt Classic','750 ml',115000,[source('Shop Rượu Vang Đà Lạt',110000,'https://shopruouvangdalat.com/vang-da-lat-classic-red-wine-750ml'),source('Én Vàng',115000,'https://envang.vn/ladora-vang-da-lat-classic-red-vietnam-750ml/')],'Đối chiếu cùng nhãn và dung tích.')
  ]
};
