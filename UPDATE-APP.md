# อัปเดตแอป KOREA WATCH รุ่น Liquid Lens

โฟลเดอร์นี้คือ **โค้ดเว็บแอป/PWA ตัวจริง** เชื่อมกับฟีด Firebase เดิม ไม่ใช่ชุดต้นแบบ START-HERE.html

แตก ZIP จาก branch `codex/liquid-lens-feed-2026-11-09` แล้วรันใน Terminal บน Mac ที่เคย deploy Firebase:

```sh
cd ~/Downloads/korea-watch-codex-liquid-lens-feed-2026-11-09/worker
npm ci
npm run deploy:hosting
```

รอข้อความ `Deploy complete!` แล้วเปิด https://korea-watch01.web.app/ ถ้าติดตั้งแอปไว้บนหน้าจอโฮม ให้ปิดและเปิดแอปใหม่

คำสั่งนี้ build แล้ว deploy เฉพาะ Hosting เข้า project เดิม `korea-watch01` ไม่ต้องตั้ง Firebase ใหม่ ไม่ต้อง deploy rules และไม่ต้อง Run workflow Fetch news สำหรับการเปลี่ยนหน้าจอนี้

หาก CLI แจ้ง `Failed to authenticate` ให้รัน `./node_modules/.bin/firebase login` แล้วรัน `npm run deploy:hosting` อีกครั้ง โดยใช้บัญชีเดิมที่มีสิทธิ์ใน project

สิ่งที่เปลี่ยนรอบนี้:

- เลนส์เมนูเลื่อนแบบสปริงและมีแรงหน่วง ขยายเฉพาะกดค้าง 0.2 วินาทีหรือเริ่มลาก แล้วหดเมื่อปล่อย
- เมนูล่างใกล้ขอบล่างและหลบพื้นที่ที่เว็บเบราว์เซอร์บัง
- หน้าตั้งค่าเหลือปุ่มทดสอบ/บันทึกด้านล่าง พร้อมย้อนกลับด้านบน
- คืนฟอนต์เดิม IBM Plex Sans Thai / Sarabun โดยเก็บไฟล์ไว้ในแอป
- ขยายภาพข่าวในกรอบเดิม เอาชิป “ใหม่” ออก และเปลี่ยนข่าวทั้งหมดเป็นการ์ดภาพเต็มเรียงลง
- หน้าอ่านข่าวเอาปุ่มย้อนกลับมุมบนออก ใช้ปุ่มปิดและปุ่มย้อนกลับด้านล่าง


ยังส่ง push เฉพาะ 5 เหตุเดิมตามที่ยืนยัน ตัวเลือกด่วน/ทุกข่าวปิดไว้ พื้นที่เป็นค่าที่บันทึกบนเครื่อง ยังไม่ได้เชื่อม Cell Broadcast เสียง/สั่นเบื้องหลังยังขึ้นกับระบบของมือถือ

รายละเอียด: [docs/ui/liquid-lens.md](docs/ui/liquid-lens.md)
