# อัปเดตแอป KOREA WATCH รุ่น UI Layout

โฟลเดอร์นี้คือ **โค้ดเว็บแอป/PWA ตัวจริง** เชื่อมกับฟีด Firebase เดิม ไม่ใช่ชุดต้นแบบ START-HERE.html

ดาวน์โหลด [ZIP จาก GitHub](https://github.com/bossbazz98/korea-watch/archive/refs/heads/codex/ui-layout-2026-11-10.zip) แล้วแตกไฟล์ จากนั้นรันใน Terminal บน Mac ที่เคย deploy Firebase:

```sh
cd ~/Downloads/korea-watch-codex-ui-layout-2026-11-10
npm --prefix worker ci
npm --prefix worker run deploy:hosting
```

รอข้อความ `Deploy complete!` แล้วเปิด https://korea-watch01.web.app/ ถ้าติดตั้งแอปไว้บนหน้าจอโฮม ให้ปิดและเปิดแอปใหม่

คำสั่งนี้ build แล้ว deploy เฉพาะ Hosting เข้า project เดิม `korea-watch01` ไม่ต้องตั้ง Firebase ใหม่ ไม่ต้อง deploy rules และไม่ต้อง Run workflow Fetch news สำหรับการเปลี่ยนหน้าจอนี้

คำสั่งใช้ `--prefix worker` เพราะ package.json และ package-lock.json อยู่ใน `worker` อย่ารัน `npm ci` เปล่า ๆ จากโฟลเดอร์หลัก

หาก CLI แจ้ง `Failed to authenticate` ให้รัน `./worker/node_modules/.bin/firebase login` แล้วรัน `npm --prefix worker run deploy:hosting` อีกครั้ง โดยใช้บัญชีเดิมที่มีสิทธิ์ใน project

สิ่งที่เปลี่ยนรอบนี้:

- หน้าตั้งค่าใช้ X มุมขวาบน ด้านล่างเป็นย้อนกลับ/บันทึก และใช้ IBM Plex Sans Thai ทั้งหน้า
- แถบล่างทุกหน้าสูง 68 px ปุ่มสูง 54 px ใช้ IBM Plex Sans Thai เมนูหลักเป็นหน้าแรก/บันทึก/ตั้งค่า ขยับลงใกล้ขอบล่างและหลบพื้นที่เบราว์เซอร์บัง
- หัวข้อส่วนต่าง ๆ และหัวข้อข่าวใช้ฐาน 20 px สรุป/เนื้อหา/รายละเอียดใช้ฐาน 16 px โดยยังปรับตามขนาดตัวอักษรที่เลือก
- เพิ่มความสูงรูปข่าวเด่นและให้รูปใช้พื้นที่ว่างในกรอบ พร้อมกรอบแดงสำหรับข่าวด่วนมากและสีอำพันสำหรับข่าวสำคัญ
- ข่าวทั้งหมดแสดง 1 คอลัมน์บนมือถือ เพิ่มเป็น 2–4 คอลัมน์ตามความกว้างหน้าจอ
- เอาข้อความเวลาอัปเดตใต้โลโก้ออก
- ดึงรีเฟรชแล้วแสดงข่าวใหม่ทันทีที่โหลดเสร็จ วงหมุนค้างอย่างน้อย 0.45 วินาทีก่อนยุบ หากโหลดนานกว่านั้นจะไม่รอเพิ่ม


ยังส่ง push เฉพาะ 5 เหตุเดิมตามที่ยืนยัน ตัวเลือกด่วน/ทุกข่าวปิดไว้ พื้นที่เป็นค่าที่บันทึกบนเครื่อง ยังไม่ได้เชื่อม Cell Broadcast เสียง/สั่นเบื้องหลังยังขึ้นกับระบบของมือถือ

ต่อยอดจากรอบ Liquid Lens ซึ่งยังไม่ได้ merge เข้า main และ push เป็น branch ใหม่โดยไม่ merge

รายละเอียด: [docs/ui/ui-layout.md](docs/ui/ui-layout.md)
