# อัปเดตแอป KOREA WATCH รุ่น Liquid Glass

โฟลเดอร์นี้คือ **โค้ดเว็บแอป/PWA ตัวจริง** เชื่อมกับฟีด Firebase เดิม ไม่ใช่ชุดต้นแบบ START-HERE.html

แตก `korea-watch-liquid-glass-app-2026-11-09.zip` แล้วรันใน Terminal บน Mac ที่เคย deploy Firebase:

```sh
cd ~/Downloads/korea-watch-liquid-glass-app-2026-11-09/worker
npm ci
npm run deploy:hosting
```

รอข้อความ `Deploy complete!` แล้วเปิด https://korea-watch01.web.app/ ถ้าติดตั้งแอปไว้บนหน้าจอโฮม ให้ปิดและเปิดแอปใหม่

คำสั่งนี้ build แล้ว deploy เฉพาะ Hosting เข้า project เดิม `korea-watch01` ไม่ต้องตั้ง Firebase ใหม่ ไม่ต้อง deploy rules และไม่ต้อง Run workflow Fetch news สำหรับการเปลี่ยนหน้าจอนี้

หาก CLI แจ้ง `Failed to authenticate` ให้รัน `./node_modules/.bin/firebase login` แล้วรัน `npm run deploy:hosting` อีกครั้ง โดยใช้บัญชีเดิมที่มีสิทธิ์ใน project

สิ่งที่เปลี่ยน: หน้าแรก/อ่านข่าว/บันทึกไว้/ตั้งค่าแบบ Liquid Glass, เมนูล่าง 3 แท็บ, บันทึกข่าวบนเครื่อง, แชร์ลิงก์และภาพสรุป, เลือกข่าวเด่น, ขนาดตัวอักษร และดึงลงรีเฟรช 80 px

ยังส่ง push เฉพาะ 5 เหตุเดิมตามที่ยืนยัน ตัวเลือกด่วน/ทุกข่าวปิดไว้ พื้นที่เป็นค่าที่บันทึกบนเครื่อง ยังไม่ได้เชื่อม Cell Broadcast เสียง/สั่นเบื้องหลังยังขึ้นกับระบบของมือถือ

รายละเอียดและข้อจำกัด: [docs/ui/liquid-glass.md](docs/ui/liquid-glass.md)
