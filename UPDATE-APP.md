# อัปเดต KOREA WATCH — เลนส์ในแอป หมวดข่าว และตัวเลือกสไลด์

ดาวน์โหลด [ZIP ใหม่จาก GitHub](https://github.com/bossbazz98/korea-watch/archive/refs/heads/codex/pwa-lens-segments-2026-11-11.zip) แล้วแตกไฟล์ รอบนี้ต่อจาก c239641 เพื่อเก็บการแก้การ์ดข่าวเดิมไว้ครบ และ push เป็น branch ใหม่โดยไม่ merge

บน Mac ที่เคย deploy Firebase รัน:

```sh
cd ~/Downloads/korea-watch-codex-pwa-lens-segments-2026-11-11
npm --prefix worker ci
npm --prefix worker run deploy:hosting
```

รอ `Deploy complete!` แล้วปิดและเปิด PWA ใหม่ หรือเปิด https://korea-watch01.web.app/ รุ่นนี้มี HTML marker `20261111-pwa-segments`

ต้องใช้ `--prefix worker` เพราะ package.json และ package-lock.json อยู่ใน worker หาก CLI แจ้ง `Failed to authenticate` ให้ใช้ `./worker/node_modules/.bin/firebase login` ด้วยบัญชีเดิม แล้วรันคำสั่ง deploy อีกครั้ง

**รอบนี้เปลี่ยนหน้าจอเท่านั้น ไม่ต้อง deploy rules ไม่ต้อง Run workflow Fetch news และไม่ต้องตั้งค่า Firebase ใหม่** เกณฑ์แจ้งเตือนสามระดับเดิมยังอยู่เหมือนเดิม

สิ่งที่เปลี่ยน:

- ขอบใสของเลนส์เห็นชัดเฉพาะตอนกดค้าง/ลาก ไม่แสดงตอนพักหรือแตะธรรมดา
- เปลี่ยนจากแผ่นสำเนาสีที่ซ้อนและ blend กัน เป็นเอฟเฟกสีบาง ๆ เฉพาะขอบตัวอักษร/ไอคอน เพื่อเลี่ยงแถบม่วงขนาดใหญ่ในแอป
- วางหมวดข่าวก่อนข่าวเด่นตามที่เลือก กรอบพอดีกับชื่อ ชื่ออยู่ด้านบน จำนวนข่าวอยู่ด้านล่าง ทั้งสองแถวเห็นเหนือเมนูล่างตั้งแต่เปิดหน้าแรก และยังปัดดูหมวดเพิ่มได้
- คงขนาดภาพการ์ดข่าวเดิม และเอาเฟดดำบนภาพหน้าอ่านออก ให้แสดงสีภาพต้นฉบับ
- ตัวเลือกภาษา ธีม และขนาดตัวอักษรเป็นแคปซูลโค้งเต็ม มีตัวเลือกเลื่อนไปยังตำแหน่งใหม่อย่างนุ่มนวล รวมถึงตอนเปลี่ยนภาษา ค่ายังบันทึกทันทีและรองรับ Reduce Motion

ทดสอบ Chromium ทั้งหน้าต่างเว็บและโหมด standalone จำลองที่ความละเอียด 3 เท่าแล้ว แต่ยังไม่ได้ยืนยันบน Safari/iPhone จริง การติดตั้ง WebKit เพิ่มถูกเครือข่ายบล็อก (`403 Domain forbidden` จากโดเมนดาวน์โหลด Playwright) หลัง deploy ควรตรวจเลนส์บนเครื่องจริงด้วย

รายละเอียดและการทดสอบ: [docs/ui/pwa-lens-segments.md](docs/ui/pwa-lens-segments.md)
