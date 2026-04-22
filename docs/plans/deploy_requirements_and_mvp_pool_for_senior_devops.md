# سند نیازمندی‌های دیپلوی پروژه و معماری MVP Pool

## هدف این سند
این سند برای تحویل به Senior DevOps تهیه شده است تا:
1. پروژه فعلی را به‌صورت production-ready دیپلوی کند.
2. یک فریم‌ورک استاندارد، تکرارپذیر و قابل‌حمل برای دیپلوی سایر MVPها طراحی و راه‌اندازی کند.

---

# 1) خلاصه کسب‌وکاری و هدف فنی
ما در حال ساخت چندین MVP هستیم که هرکدام در ابتدا مشتریان کمی دارند. هدف این است که:
- با کمترین هزینه و پیچیدگی، MVPها سریع بالا بیایند.
- هر MVP در صورت موفق شدن، به‌راحتی قابل استخراج و انتقال به زیرساخت قوی‌تر باشد.
- زیرساخت از ابتدا طوری طراحی شود که برای چندین پروژه قابل استفاده باشد.
- ساختار تا حد ممکن vendor-neutral و portable باشد تا روی سرورهای خارجی و داخلی قابل پیاده‌سازی باشد.

پروژه فعلی اولین MVP است و باید روی این ساب‌دامین بالا بیاید:
- `reform-hotel.clientora.net`

---

# 2) معیارهای اصلی که برای ما مهم هستند

## اولویت‌های اصلی
1. **پایداری و قابل اعتماد بودن سرویس**
   - سرویس باید برای تحویل به مشتری نهایی مناسب باشد.
   - ری‌استارت سرویس‌ها، لاگ‌گیری، health check و recovery معقول داشته باشد.

2. **هزینه پایین و کنترل‌شده**
   - در فاز MVP نباید از زیرساخت گران و پیچیده استفاده شود.
   - ترجیح با اشتراک‌گذاری منطقی منابع بین MVPها است.

3. **قابل ارتقا بودن**
   - هر MVP باید بتواند بعداً به سرور یا زیرساخت مستقل منتقل شود.
   - رشد عمودی و افقی باید در طراحی در نظر گرفته شود.

4. **vendor lock کم**
   - وابستگی شدید به قابلیت‌های اختصاصی یک provider نداشته باشیم.
   - قرارداد اصلی دیپلوی باید Docker/Compose-based باشد.

5. **قابل حمل بودن بین خارج و داخل ایران**
   - سیستم باید تا حد ممکن روی Hetzner و همچنین روی سرویس‌های داخل ایران مثل Liara/Chabokan یا VPS داخلی قابل پیاده‌سازی باشد.
   - تا جای ممکن از الگوهای استاندارد و جهانی استفاده شود.

6. **سادگی عملیات**
   - دیپلوی اولیه و دیپلوی‌های بعدی باید سریع، شفاف و قابل تکرار باشند.
   - ترجیح اولیه با CLI/SSH-based deployment است، هرچند بعداً امکان pipeline اتوماتیک هم باید وجود داشته باشد.

7. **پشتیبانی از staging/test و production**
   - برای هر MVP باید امکان داشتن محیط تست و production وجود داشته باشد.
   - ترجیحاً دامنه تست از production جدا باشد.

8. **مایگریشن دیتابیس خودکار**
   - در زمان دیپلوی production و staging، migrationها باید به‌صورت controlled و automated اجرا شوند.

---

# 3) دارایی‌ها و وضعیت فعلی
در حال حاضر این موارد موجود هستند:

1. **دامین اصلی**
   - `clientora.net`
   - DNS روی Cloudflare مدیریت می‌شود.
   - Registrar فعلی: GoDaddy

2. **سرور اصلی**
   - یک VPS لینوکسی از Hetzner تهیه شده است.
   - دسترسی SSH فعال است.
   - دسترسی SSH در اختیار DevOps قرار داده می‌شود.

3. **وضعیت نصب و آماده‌سازی سرور**
   - برخی اجزای زیرساختی ممکن است از قبل نصب شده باشند.
   - به‌طور مشخص، احتمالاً PostgreSQL روی سرور نصب شده است.
   - اما وضعیت فعلی سرور نباید مفروض گرفته شود.
   - DevOps باید تمام پیش‌نیازها، نصب‌ها، سرویس‌ها، نسخه‌ها، تنظیمات، امنیت پایه و صحت پیکربندی‌ها را **به‌صورت کامل audit و verify** کند.

4. **پروژه فعلی**
   - repository آماده است.
   - پروژه در محیط development کار می‌کند.
   - هدف فعلی: deploy کردن branch اصلی روی:
     - `reform-hotel.clientora.net`

## نکته مهم درباره وضعیت فعلی
اگرچه ممکن است بعضی موارد از قبل روی سرور نصب شده باشند، انتظار ما این است که DevOps:
- وضعیت موجود را بررسی و مستند کند.
- تشخیص دهد چه چیزهایی قابل استفاده‌اند و چه چیزهایی باید اصلاح یا reinstall شوند.
- هیچ بخش مهمی را صرفاً به این دلیل که "ظاهراً نصب است" نهایی فرض نکند.

حداقل مواردی که باید بررسی شوند:
- سیستم‌عامل و نسخه آن
- وضعیت کاربران و دسترسی SSH
- Docker / Docker Compose
- PostgreSQL
- reverse proxy
- firewall / basic security hardening
- DNS assumptions
- SSL setup
- disk / memory / CPU baseline
- log strategy
- backup readiness

---

# 4) معماری کلان پیشنهادی

## انتخاب سیستم‌عامل
- سرور اصلی باید Linux-based باشد.
- ترجیح: Ubuntu Server LTS

## الگوی کلی زیرساخت
معماری MVP Pool باید به این شکل باشد:
- یک سرور اصلی برای چند MVP اولیه
- هر MVP به‌صورت یک پروژه مستقل deploy شود
- هر MVP روی ساب‌دامین خودش در دسترس باشد
- بعضی MVPها بتوانند علاوه بر subdomain، custom domain اختصاصی هم داشته باشند
- هر MVP بعداً بتواند به زیرساخت جدا منتقل شود

## اصل مهم
**هر MVP = یک واحد deploy مستقل**

این یعنی برای هر MVP:
- repo مستقل یا حداقل deploy unit مستقل
- env مستقل
- سرویس اپلیکیشن مستقل
- دیتابیس مستقل
- دامنه یا ساب‌دامین مستقل

---

# 5) MVP Pool Architecture

## قرارداد اصلی دیپلوی
قرارداد اصلی و جهانی برای دیپلوی باید این باشد:
- **Docker Compose** به‌عنوان deployment contract
- نه قرارداد اختصاصی provider

یعنی هر MVP باید بتواند با الگوی مشابه روی این محیط‌ها deploy شود:
- Hetzner VPS
- VPS داخلی
- در صورت نیاز سرویس‌های داخل ایران

## ساختار مورد نظر برای هر MVP
برای هر MVP انتظار داریم:
- یک `compose.yaml` یا معادل استاندارد
- فایل env جدا برای هر environment
- migration command مشخص
- healthcheck مشخص
- logging strategy مشخص
- backup/restore strategy مشخص

## مدل دامنه‌ها
برای هر MVP:
- production روی یک subdomain از دامنه اصلی
- staging/test روی دامنه تست جدا یا الگوی ایزوله‌شده

مثال:
- Production:
  - `reform-hotel.clientora.net`
- Staging/Test:
  - `reform-hotel.test-domain.com`

در آینده برای پروژه‌های دیگر:
- `project-a.clientora.net`
- `project-b.clientora.net`
- `project-c.clientora.net`
- و در صورت نیاز:
  - `xyz.com` -> همان پروژه production

## مدیریت DNS
- Cloudflare باید در لایه DNS و proxy مورد استفاده باشد.
- امکان wildcard و subdomain-based routing در طراحی در نظر گرفته شود.

---

# 6) اجزای زیرساخت و نحوه مدیریت آن‌ها

## Reverse Proxy / SSL
- یک reverse proxy مرکزی برای مدیریت domain routing و SSL لازم است.
- ترجیح فعلی: Caddy یا معادل مناسب
- هدف: صدور و تمدید ساده گواهی و route شدن هر domain به سرویس مربوطه

## Application Services
- هر MVP به‌صورت container/service مستقل اجرا شود.
- هر پروژه نباید با سایر پروژه‌ها در یک container مشترک ادغام شود.

## PostgreSQL
- یک PostgreSQL مرکزی روی سرور اصلی قابل قبول است.
- اما برای هر MVP باید:
  - **database جدا**
  - **db user/role جدا**
- استفاده از یک database مشترک برای همه MVPها توصیه نمی‌شود.

هدف این است که extraction هر MVP بعداً ساده باشد.

## Redis / RabbitMQ / سایر سرویس‌های جانبی
- در صورت نیاز، این سرویس‌ها باید به‌صورت container/service جدا اجرا شوند.
- نه داخل application container
- در فاز اول می‌توانند shared باشند، ولی باید با namespace/vhost/prefix مناسب از هم تفکیک شوند.
- اگر یک MVP جدی شد، باید امکان جدا کردن سرویس‌هایش وجود داشته باشد.

## File Storage
هدف ما داشتن یک راهکار استاندارد و جهانی است.
- application layer باید با **S3-compatible object storage** کار کند.
- backend storage باید قابل تعویض باشد.

سناریوهای قابل قبول:
- خارج ایران: object storage سازگار با S3
- داخل ایران یا self-hosted: MinIO یا معادل S3-compatible

فایل‌ها نباید داخل application container ذخیره شوند.

---

# 7) نیازمندی‌های اجرایی برای پروژه اول

## تسک اول DevOps
هدف: deploy کردن پروژه فعلی روی production

### خروجی مورد انتظار
پروژه فعلی باید روی آدرس زیر در دسترس باشد:
- `reform-hotel.clientora.net`

### حداقل موارد مورد انتظار در این تسک
1. آماده‌سازی سرور Hetzner
2. نصب و کانفیگ ابزارهای مورد نیاز برای اجرای production
3. راه‌اندازی PostgreSQL
4. ساخت database و user مستقل برای پروژه فعلی
5. راه‌اندازی reverse proxy و SSL
6. تنظیم DNS در Cloudflare در صورت نیاز
7. دیپلوی branch اصلی پروژه
8. تنظیم migration خودکار دیتابیس در فرآیند deploy
9. اطمینان از restart policy، logging و basic observability
10. مستندسازی commandهای اصلی deploy / restart / rollback / logs

## انتظار ما از deploy پروژه اول
- production-ready باشد
- قابل تکرار باشد
- بدون وابستگی به setup دستی پراکنده انجام شود
- اسکریپت یا workflow مشخص برای redeploy داشته باشد

---

# 8) نیازمندی‌های فریم‌ورک کلی برای سایر پروژه‌ها

## تسک دوم DevOps
هدف: ساختن framework استاندارد برای deploy سایر MVPها

### این framework باید این ویژگی‌ها را داشته باشد:
1. **افزودن MVP جدید سریع باشد**
   - با کمترین کانفیگ اضافه
   - با الگوی تکرارپذیر

2. **حذف MVP ساده باشد**
   - بدون تخریب سایر پروژه‌ها

3. **staging و production برای هر MVP پشتیبانی شود**
   - domain mapping جدا
   - env جدا
   - database جدا

4. **deploy از روی branch استاندارد باشد**
   - حداقل `main -> production`
   - یک branch دیگر برای staging/test

5. **migration خودکار باشد**
   - ولی controlled و safe

6. **ساختار naming استاندارد داشته باشد**
   - برای project/service/container/database/user/domain

7. **استخراج و انتقال هر MVP ساده باشد**
   - app و data به‌راحتی به سرور جدا منتقل شوند

8. **روی VPSهای دیگر هم قابل پیاده‌سازی باشد**
   - چه در خارج ایران چه در داخل ایران

9. **تا جای ممکن provider-agnostic باشد**
   - deployment contract بر پایه Docker Compose / containerized services باقی بماند

10. **امکان اجرای deploy از CLI سیستم local وجود داشته باشد**
   - و در آینده امکان تبدیل به pipeline اتوماتیک هم وجود داشته باشد

---

# 9) الگوی پیشنهادی برای mapping پروژه‌ها

## مثال desired mapping
- `hotel-message` repo
  - production -> `reform-hotel.clientora.net`
  - test/staging -> `reform-hotel.test-domain.com`

در آینده:
- `project-a` repo
  - production -> `project-a.clientora.net`
  - staging -> `project-a.test-domain.com`

- `project-b` repo
  - production -> `project-b.clientora.net`
  - staging -> `project-b.test-domain.com`

- `project-c` repo
  - production -> `project-c.clientora.net`
  - also -> custom domain مثل `xyz.com`

---

# 10) ملاحظات طراحی مهم

## Isolation منطقی
- isolation کامل در حد dedicated infrastructure برای همه MVPها در فاز اول لازم نیست.
- اما isolation منطقی در این سطح لازم است:
  - container/service مستقل
  - env مستقل
  - database مستقل
  - storage namespace مستقل

## Shared vs Dedicated
در فاز MVP pool می‌پذیریم که برخی اجزا shared باشند، به شرطی که extraction بعدی ساده بماند.

### Shared acceptable
- VPS اصلی
- reverse proxy
- PostgreSQL server
- Redis / RabbitMQ در صورت نیاز
- object storage backend در صورت نیاز

### Dedicated required per MVP
- app service/container
- database
- db credentials
- env config
- domain mapping
- migration flow

## Backup / Restore
- برای کل سرور backup لازم است.
- برای هر دیتابیس هم backup منطقی و قابل restore لازم است.
- restore process باید تست‌پذیر و مستند باشد.

## Security
- secrets نباید داخل repo hardcode شوند.
- env management تمیز و حداقل‌گرا باشد.
- دسترسی‌ها تا حد امکان محدود و least-privilege باشند.

---

# 11) خروجی‌هایی که از Senior DevOps انتظار داریم

## خروجی تسک اول
- پروژه فعلی روی `reform-hotel.clientora.net` بالا آمده باشد
- production deploy flow مستند شده باشد
- migration خودکار تنظیم شده باشد
- database و reverse proxy درست کانفیگ شده باشند

## خروجی تسک دوم
- یک blueprint/framework تکرارپذیر برای deploy سایر MVPها آماده شده باشد
- naming convention مشخص شده باشد
- الگوی staging/prod مشخص شده باشد
- الگوی domain mapping مشخص شده باشد
- الگوی database creation و isolation مشخص شده باشد
- الگوی add/remove MVP مشخص شده باشد
- الگوی backup/restore و extraction مشخص شده باشد

---

# 12) تصمیم‌های فنی ترجیحی ما
این‌ها ترجیحات فعلی ما هستند و DevOps می‌تواند در صورت وجود دلیل قوی، پیشنهاد بهبود بدهد:

- Linux server (ترجیحاً Ubuntu LTS)
- Docker + Docker Compose
- PostgreSQL shared server with per-project isolated databases
- Reverse proxy مرکزی (ترجیحاً Caddy)
- Cloudflare برای DNS و domain management
- S3-compatible approach برای file storage
- CLI-friendly deployment flow
- architecture قابل حمل بین Hetzner و زیرساخت‌های داخل ایران

---

# 13) انتظار نهایی
هدف ما فقط deploy یک پروژه نیست.
هدف ما ساختن یک **زیرساخت MVP Factory / MVP Pool** است که:
- ارزان باشد
- ساده باشد
- قابل گسترش باشد
- قابل استخراج باشد
- و برای چند پروژه مختلف قابل استفاده باشد

Senior DevOps می‌تواند در جزئیات پیاده‌سازی بهترین تصمیم‌های فنی را بگیرد، اما باید این اصول و اهداف را حفظ کند.

