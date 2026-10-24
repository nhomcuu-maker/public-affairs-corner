# Kho van ban theo danh muc - ban nang cap co kiem soat

Sao luu du an. Giai nen ZIP vao thu muc goc GocDanSinh.

1. node tools/catalog/sync-official.cjs
2. node tools/catalog/test-category.cjs
3. npm run dev
4. Mo http://127.0.0.1:3001/kho-van-ban.html

Chay `node tools/catalog/sync-official.cjs` bang Windows Task Scheduler moi ngay de cap nhat RSS. Ket noi Internet can thiet. Script doc `public/library-catalog.json`, bo sung metadata RSS Cong bao dien tu va viet `public/category-index.json`. Khong sua SQL/du lieu da kiem duyet. Khong download hoac tu tao PDF cong bao tu RSS. Chi muc chua co tai lieu hien ro 0/20, khong nhan ban van ban sai chu de. Muc chi co metadata can mo lien ket goc.

Trang Phap luat: /kho-van-ban.html?domain=LEGAL . Trang Thu tuc: /kho-van-ban.html?domain=ADMIN . Mot noi dung chi duoc gan khi tu khoa/dieu kien phu hop, nen chua bao dam 20 file cho moi muc. Cac muc can thu thap them tu co so du lieu van ban phap luat va Cong dich vu cong; RSS Chi cung cap metadata.

Khong phuc vu du lieu nhap chua duyet nhu da duoc phat hanh. De cap nhat thu tuc theo tinh/thanh can co connector/API duoc phep truy cap va mapping co quan thuc hien - chua co trong ban nay.
