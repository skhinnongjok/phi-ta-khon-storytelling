# Phi Ta Khon: Living Heritage Storytelling

รุ่นส่งต่อ **2026.11.02-3 — 2 พฤศจิกายน 2569 (2026), Asia/Bangkok**

WebAR หน้าเดียว รองรับ PTK-001 ถึง PTK-005 ใช้ A-Frame 1.5.0 และ MindAR Image Tracking 1.2.5 ที่เก็บไว้ใน `vendor/` ไม่ต้องติดตั้ง npm หรือ backend

## เริ่มงานในเครื่องใหม่

คัดลอกโฟลเดอร์นี้ทั้งโฟลเดอร์ รวม `assets/`, `vendor/`, JavaScript ทุกไฟล์ และเอกสาร ไม่ต้องรักษาชื่อผู้ใช้หรือ absolute path ของเครื่องเดิม

เปิด Terminal **ภายในโฟลเดอร์ phi-ta-khon-ar-postcards** แล้วรัน:

```sh
python3 -m http.server 8010 --bind 127.0.0.1
```

Windows ใช้ `py -m http.server 8010 --bind 127.0.0.1` จากนั้นเปิด http://127.0.0.1:8010/

หากเปิด Terminal จากโฟลเดอร์แม่ `phi-ta-khon-storytelling` ให้ใช้ URL http://127.0.0.1:8010/phi-ta-khon-ar-postcards/ แทน

ห้ามเปิดผ่าน `file://` กล้องต้องใช้ localhost หรือ HTTPS โทรศัพท์ต้องเปิด URL HTTPS ของเว็บไซต์ที่ deploy แล้ว; localhost บนมือถือหมายถึงมือถือเอง และ HTTP ผ่าน IP ของคอมพิวเตอร์ไม่ใช่ secure context

## พฤติกรรมปัจจุบัน

- หน้าแรกเปิดกล้องสด มีข้อความ Living Heritage Storytelling / AR Ta Khon Story / ถอดรหัสหน้ากากผีตาโขน และปุ่มเริ่มสแกน AR
- PTK-001: เวที 2.5D ตัวละคร ภาพท่า idle/wave/talk และปุ่มฟังเรื่องเล่า พัก เล่นต่อ เล่นใหม่
- PTK-002: ฉากป่า ฐาน เงา ตัวละครโบกมือวนแบบ frame-based 6 เฟรม ไม่มี foreground ไม่มีปุ่มเลือกท่า และมีเสียงเล่าเรื่องตำนาน/ความเชื่อพร้อมภาพ insert
- PTK-003: คู่ผีตาโขนใหญ่โยกตัว 12 เฟรม พร้อมภาพข้อความ popup ด้านบนและเสียงผู้ชาย 56.6 วินาที ไม่มีพื้นหลัง เงา หรือเวที ใช้ภาพ master ที่ผู้ใช้เลือกเดิม; ภาพสแกนเป็นอีกไฟล์ตามที่ผู้ใช้แนบล่าสุด
- PTK-004: หน้ากากและ label องค์ประกอบจากกราฟิกผู้ใช้ แสดงทีละส่วนตามเวลาเสียง 48.1 วินาที แล้วรวมภาพตอนท้าย ไม่มีขั้นตอนการทำ
- PTK-005: ภาพขั้นตอนทำหน้ากาก 9 ขั้นกับเสียงผู้ใช้ 93.6 วินาที ใช้สำเนาภาพ WebP สำหรับมือถือ เก็บ PNG ต้นฉบับครบ ภาพสแกนใหม่เป็นภาพช่างที่ผู้ใช้เลือกเวลา 14:08 วันที่ 2 พฤศจิกายน
- ใช้ UI ร่วมกัน ไม่มีเว็บแอปแยกตามการ์ด การสลับไปการ์ดอื่นจะพักและรีเซ็ตเรื่องเดิม เลือกเสียงให้ตรง PTK-001/002/003/004/005 ด้วยปุ่มเสียงเดิม
- ปุ่มปิดกลับหน้าแรกโดยยังคงกล้อง preview; ออกจากหน้าจึงหยุดระบบกล้อง

## ภาพที่ใช้สแกนจริง

| การ์ด | ภาพสแกน | targetIndex |
| --- | --- | --- |
| PTK-001 | `assets/PTK-001-assets/PTK-001-scan.png` | 0 |
| PTK-002 | `assets/PTK-002-assets/PTK-002-scan.png` | 1 |
| PTK-003 | `assets/PTK-003-assets/PTK-003-scan.png` | 2 |
| PTK-004 | `assets/PTK-004-assets/PTK-004-scan.png` | 3 |
| PTK-005 | `assets/PTK-005-assets/PTK-005-scan.png` | 4 |

ใช้ภาพเต็มบนพื้นขาว ไม่ครอปหรือเปลี่ยนสัดส่วน หน้าเว็บโหลด **`assets/postcard-targets.mind`** ซึ่งรวมทั้งห้า target แล้ว การเปลี่ยนภาพ PNG อย่างเดียวไม่เปลี่ยนข้อมูลตรวจจับ ต้อง compile และรวม `.mind` ใหม่ด้วย

PTK-001 ใช้ `PTK-001-scan.png` และ `PTK-001-target.mind` เดิม; นำ Target รุ่นเก่าที่ไม่ใช้งานออกแล้ว ตัวละครยังใช้ `character-idle.png` และท่า wave/talk ตามเดิม

## แผนที่ไฟล์

```text
index.html                 UI, scripts, scene, anchors และ target bundle
app.js                     กล้อง, การสลับการ์ด, ปุ่มเสียงและ lifecycle
ar-components.js           ตัวละครและเวที PTK-001
ptk002-components.js       ฉากป่าและตัวเล่นเฟรมโบกมือ PTK-002
ptk003-components.js       คู่ผีตาโขนใหญ่และข้อความ popup
ptk004-components.js       หน้ากากและ label ตามเวลาเสียง
ptk005-timeline.js         ฟังก์ชันเลือกภาพขั้นตอนตามเวลาเสียง
ptk005-components.js       แผงภาพทำหน้ากาก 9 ขั้นและ prefetch/cache
styles.css                 UI เดิมและฟอนต์ local
assets/PTK-001-assets/     ต้นฉบับ ภาพสแกน เสียง และ assets 2.5D
assets/PTK-002-assets/     master ภาพสแกน sprite sheet ฉากและเงา
assets/PTK-003-assets/     master ภาพสแกน Target ข้อความและเสียง
assets/PTK-004-assets/     กราฟิกต้นฉบับ ภาพสแกน Target เสียง และ lesson cues
assets/PTK-005-assets/     ภาพขั้นตอนต้นฉบับ/runtime เสียง ภาพสแกนใหม่ และ history
assets/postcard-targets.mind  target รวมตามลำดับ 001, 002, 003, 004, 005
vendor/                    ไลบรารีและใบอนุญาต
data/postcards.json        ทะเบียนเนื้อหา (ยังไม่ใช่ runtime configuration)
docs/                      สถานะล่าสุดและแนวทางเพิ่มการ์ด
docs/history/             บันทึกเก่าเพื่ออ้างอิง ไม่ใช่สเปกปัจจุบัน
tests/                     regression tests (ใช้ Node.js เมื่อต้องตรวจ)
version.json               รุ่นส่งต่องาน
```

ไฟล์ `docs/checksums.sha256` บันทึก SHA-256 ของชุดส่งต่อ (paths อ้างจาก root ของแอป) ใช้ `shasum -a 256 -c docs/checksums.sha256` บน macOS หรือ `sha256sum -c docs/checksums.sha256` บน Linux เพื่อตรวจหลังคัดลอก หากแก้ไฟล์ต่อแล้ว hash จะต่างตามการแก้ไข

อ่าน [สถานะการพัฒนาล่าสุด](docs/DEVELOPMENT-STATUS.md) และ [วิธีเพิ่มการ์ดถัดไป PTK-006 เป็นต้นไป](docs/ADDING-CARDS.md) ก่อนเริ่มแก้โค้ด

## GitHub Pages และการย้ายเครื่อง

อัปโหลด **เนื้อหาของโฟลเดอร์นี้ทั้งหมด** ลง directory ที่ Pages publish ถ้า repository ใช้ root ให้ `index.html`, `app.js`, `ptk002-components.js`, `ptk003-components.js`, `ptk004-components.js`, `ptk005-timeline.js`, `ptk005-components.js`, `assets/`, `vendor/` อยู่ระดับเดียวกัน ถ้า publish แบบ subdirectory ให้เก็บโครงสร้างทั้งชุดภายใต้ subdirectory เดิม

อย่าลืม `ptk002-components.js` — ครั้งก่อน GitHub ขาดไฟล์นี้ ทำให้ตรวจพบ PTK-002 แต่ภาพไม่แสดง แก้แล้วผู้ใช้ยืนยันว่าใช้ได้บนมือถือ รุ่นนี้เรียก `?v=2` เพื่อลดปัญหา cache

ตรวจบนเครื่องใหม่:

```sh
node --check app.js
node --check ar-components.js
node --check ptk002-components.js
node --check ptk003-components.js
node --check ptk004-components.js
node --check ptk005-timeline.js
node --check ptk005-components.js
node tests/card-selection.cjs
node tests/three-card-audio.cjs
node tests/four-card-audio.cjs
node tests/five-card-audio.cjs
node tests/ptk005-timeline.cjs
node tests/ptk004-timeline.cjs
node tests/ptk002-wave.cjs
node tests/ui-unchanged.cjs
```

Node.js ใช้สำหรับตรวจเท่านั้น ไม่จำเป็นต่อการเปิดเว็บไซต์ ทดสอบสแกนทั้งห้าการ์ดบนมือถือหลัง deploy ทุกครั้ง

`data/postcards.json` มีลิงก์เอกสารความรู้ในโฟลเดอร์พี่น้อง `../phi-ta-khon-knowledge-base/` ลิงก์เหล่านี้เป็น metadata อ้างอิงซึ่ง runtime ปัจจุบันไม่ได้เรียก ถ้าต้องเปิดเอกสารความรู้ในอนาคต ให้ย้ายโฟลเดอร์ knowledge-base ไปด้วยหรือปรับ URL ให้ตรงปลายทาง

ใบอนุญาตไลบรารีอยู่ใน `vendor/`; assets และข้อมูลแหล่งที่มาเก็บไว้ตามเดิม

## PTK-004: จังหวะภาพประกอบเสียง

`assets/PTK-004-assets/PTK-004-lesson.json` เก็บ cues เป็นวินาที เริ่มจาก mask → basket → coconut → wood → cloth → overview การพักเสียงคงอยู่ช่วงเดิม เล่นต่อหรือย้อนเสียงจะอ่านตำแหน่งจาก currentTime โดยตรง จังหวะเริ่มต้นจัดไว้ประมาณตามบทพูดและความยาวเสียง ควรฟังบนมือถือเพื่อเก็บจังหวะให้ตรงถ้อยคำอีกครั้ง

ภาพปลีมะพร้าวแสดงเฉพาะภาพรวมตามกราฟิกผู้ใช้ ไม่เพิ่มคำอธิบายใหม่ในเสียง S09 ไม่ได้ยืนยันรายละเอียดวัสดุเขา ส่วนขั้นตอนการทำสงวนไว้สำหรับ assets อีกชุดตามที่ผู้ใช้กำหนด

## PTK-005

เริ่มภาพปกก่อนกดฟัง จากนั้นเปลี่ยนภาพ 9 ขั้นตาม media currentTime พัก/เล่นต่อคงอยู่ในขั้นเดิม เริ่มใหม่กลับภาพปก และเมื่อเสียงจบค้างขั้น 9 ไม่เพิ่มปุ่มเลือกขั้นในหน้า scanner

`assets/PTK-005-assets/PTK-005-lesson.json` มี start เป็นวินาทีสำหรับแต่ละขั้น ค่าตั้งต้นเป็นการประมาณจากเนื้อหาและความยาวเสียง ยังไม่ได้ถอด/ตรวจคำระดับวินาที ควรฟังเทียบและปรับบนมือถือ

Runtime ใช้ภาพ WebP 9 ภาพรวมประมาณ 1.65 MB แทน PNG ต้นฉบับ 37.2 MB โหลดภาพปัจจุบันและถัดไป และจำกัด cache ไม่เก็บ texture ของภาพทั้ง 9 ค้างพร้อมกัน ยังเก็บ PNG ต้นฉบับครบ

## PTK-001 อัปเดต 2 พฤศจิกายน 2026 รอบบ่าย — 2026.11.02-3

ใช้เสียงจริง PTK-001-รู้จักผีตาโขน.mp3 ยาว 60.186062 วินาที แทนเสียง demo
นำ backdrop/foreground ออก คงฐาน เงา และตัวละครเดิม ภาพ JPEG ไม่ครอปอยู่หลังตัวละคร:
15s insert3 → 28s insert4 → 38s insert2 → 51s insert1 (ค้างถึงจบ)
ก่อน 15s ไม่มี insert ใช้ currentTime ของเสียง พัก/เล่นต่อ/เล่นใหม่ด้วยปุ่มเดิม
ดูรายการไฟล์ใน assets/PTK-001-assets/README.md; แก้ cue ที่ ptk001-story-inserts ใน ar-components.js
ตรวจเพิ่มด้วย node tests/ptk001-inserts.cjs

## PTK-002 — เรื่องเล่าตำนานและความเชื่อ (2026.11.02-3)

ใช้เสียง PTK-002-เรื่องเล่า ความเชื่อ.mp3 ยาว 56.111 วินาที ผ่านปุ่มเสียงเดิม
- 0–ก่อน 9s: forest-backdrop.png เดิม
- 9–ก่อน 28s: PTK-002-insert3.jpg (วินาที 20 คงภาพเดิม ไม่เริ่ม fade ซ้ำ)
- 28–ก่อน 36s: PTK-002-insert1.jpg
- 36–ก่อน 48s: PTK-002-insert2.jpg
- 48s–จบ: PTK-002-insert5.jpg

เมื่อมี insert จะซ่อน forest-backdrop.png เท่านั้น คงฐาน เงา และ character โบกมือ 6 เฟรม
ภาพไม่ครอป หันหากล้องอยู่หลัง character และยกศูนย์ภาพไปที่ y=0.90 เพื่อลดการบัง
ก่อนฟัง/เล่นใหม่คืนฉากป่า พักคงภาพเดิม เล่นต่ออิง currentTime จบค้าง insert5
สลับการ์ดหรือปิดจะซ่อนภาพ ไม่ให้เรื่องของการ์ดอื่นมาเปลี่ยนภาพของ PTK-002
JPEG/เสียง/scan/target และ assets เดิมคงไบต์เดิม จำกัด texture ภาพ insert ในหน่วยความจำสูงสุด 1024px
insert4 ยังเก็บไว้ แต่ไม่โหลดเพราะไม่ได้อยู่ใน timestamp ที่ผู้ใช้ระบุ

Runtime: ptk002-components.js ?v=3, app.js ?v=12; ใช้ index.html/ปุ่มเดิม Target รวมและดัชนีไม่เปลี่ยน
ตรวจ syntax, tests ทั้งหมด, browser cue/pause/replay/source switching และ MindAR จากกล้องจำลองแล้ว ยังไม่ใช่ผลทดสอบมือถือจริง
