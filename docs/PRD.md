# LAYİHƏ TƏSDİQ SƏNƏDİ (PRD): BAKUGAN İNTERAKTİV SİMULYATOR VƏ ENSİKLOPEDİYASI

## 1. LAYİHƏNİN REZÜMESİ (XÜLASƏ)
Bu layihə, Bakugan kainatını müasir veb texnologiyaları vasitəsilə tam interaktiv, 3D vizual simulyator və ensiklopediyaya çevirməyi hədəfləyir. İstifadəçilər 6 fərqli elementə aid Bakuganları araşdıra, onları 360° vizuallaşdıra, cizgi filmindəki kimi animasiya və səs effektləri ilə aktivləşdirə bilərlər.

---

## 2. ƏSAS MEXANİKALAR VƏ FUNKSİONALLIQ

### A. Element və Bakugan Seçim Sistemi
* **6 Element Filtri:** Giriş ekranında fərqli dizayn və rəng tonlarına malik 6 element bölməsi olacaq:
  * 🔥 **Pyrus** (Atəş)
  * 💧 **Aquos** (Su)
  * 🪨 **Subterra** (Torpaq)
  * 🌪️ **Ventus** (Külək)
  * ☀️ **Haos** (İşıq)
  * 🔮 **Darkus** (Qaranlıq)
* **Bakugan Ensiklopediyası:** Seçilən elementə kliklədikdə, həmin qrupa aid olan bütün klassik və yeni Bakuganların interaktiv siyahısı açılır.

### B. İki Mərhələli 3D Baxış (Viewer) Sistemi
* **Mərhələ 1: Top (Sferik) Versiya**
  * Bakugan ilk seçildiyi an qapalı (top) halında ekranda görünür.
  * **İdarəetmə:** 360° sərbəst fırlatma (orbit idarəsi), yaxınlaşdırma və uzaqlaşdırma (Zoom in / Zoom out) funksiyaları mövcuddur. İşıqlandırma geometrik və tekstura detallarını tam bəlli edəcək şəkildə qurulur.
* **Mərhələ 2: Böyük (Açıq / Canavar) Versiya**
  * Ekranda yerləşən xüsusi **"Ayağa Qalx!" (Bakugan, Brawl!)** düyməsinə basıldıqda keçid başlayır.
  * Keçid zamanı orijinal anime səs effektləri və xüsusi transformasiya animasiyası işə düşür.
  * Bakugan böyük canavar formasına keçdikdən sonra da istifadəçi eyni şəkildə modeli 360° fırlada və hər bir detalını (qanad, pəncə, göz və s.) yaxınlaşdıraraq incələyə bilər.

### C. Gate Card (Keçid Kartı) və G-Power Mexanikası
* **Gate Card Yerləşdirmə:** Bakugan sferik formadan birbaşa havada açılmır. Əvvəlcə ekrana "Gate Card, Set!" əmri ilə keçid kartı atılır və top bu kartın üzərinə enərək animasiya ilə açılır.
* **Dinamik G-Power Sayğacı:** Transformasiya anında ekranın sağ və ya sol küncündə cizgi filmindəki formatda hər Bakuganın rəqəmsal güc xalı (məsələn: 500G -> 800G) dinamik şəkildə artaraq vizuallaşdırılır.
* **Təkamül (Evolusiya) Siyahısı:** Hər bir Bakuganın əsas profilində onun zamanla keçdiyi təkamül formaları (məsələn: Dragonoid -> Delta Dragonoid -> Ultimate Dragonoid) xronoloji siyahı və fərqli model seçimləri olaraq yer alır.

### D. Ability Card (Bacarıq Kartı) və Vizual Effektlər
* **Kart Siyahısı:** Hər bir Bakuganın profilində ona aid spesifik "Ability" kartları düymə şəklində düzülür.
* **Aktivasiya (Kartı Aktivləşdir):** Düyməyə basıldıqda candan personaj nidası ilə *"Ability Activate!"* səs effekti verilir.
* **Vizual Şou (Hissəcik/Particle Effektləri):** Kartın xüsusiyyətinə uyğun olaraq 3D model üzərində və ətrafında xüsusi effektlər yaradılır:
  * *Pyrus:* Ağızdan və ya bədəndən atəş topları, alov dalğaları.
  * *Aquos:* Sferik su kütlələri, güclü su şırnaqları.
  * *Haos:* Ekranı bürüyən parlaq işıq şüaları və s.

---

## 3. MÜTƏQQƏD VƏ KONSEPTUAL ƏLAVƏLƏR

### A. Səsli Əmr Modulu
* İstifadəçinin düymələrə basmaq yerinə, brauzer mikrofonu vasitəsilə canlı səslə *"Ability Activate!"*, *"Gate Card, Set!"* və ya *"Pyrus Dragonoid, Ayağa Qalx!"* əmrlərini verməsi və sistemin bu səsləri tanıyaraq müvafiq animasiyaları avtomatik başlatması.

### B. "Mənum Kolleksiyam" (Profil və Deste Sistemi)
* İstifadəçilərin qeydiyyatdan keçərək özlərinə 3 fərqli Bakugan və xüsusi Ability/Gate kartlarından ibarət şəxsi "Deste" (Deck) qurması funksionallığı.

### C. Bakugan Generator (Öz Bakuganını Yarat)
* Mövcud Bakugan hissələrinin (Dragonoid qanadı, Tigrerra pəncəsi və s.) kombinasiyası ilə istifadəçinin özünəxas unikal 3D mexanika yığması və onu seçdiyi element rəngləri ilə fərdiləşdirməsi modulu.

### D. PvP / PvE Döyüş Sistemi (Gələcək Yol Xəritəsi)
* İki oyunçunun və ya oyunçu ilə süni intellektin qarşı-qarşıya gəldiyi, kart strategiyalarına və G-Power hesablamalarına əsaslanan növbəli (turn-based) strateji döyüş rejiminin inteqrasiyası.

---

## 4. TEXNİKİ TƏLƏBLƏR VƏ MEMARLIQ (SÜNİ İNTELLEKT ÜÇÜN TƏLİMAT)
* **Frontend:** React.js / Vue.js, Tailwind CSS (Modern Anime/Cyberpunk UI dizayn üslubu).
* **3D Render & İdarəetmə:** Three.js / React Three Fiber (R3F) vasitəsilə .gltf və ya .glb formatlı modellərin animasiya (skeletal rigging) ilə idarəsi.
* **Səs İnfrastrukturu:** Web Audio API (Səs effektləri və fon musiqilərinin sinxronizasiyası).
* **Effektlər:** Three.js Particle Systems və ya Shaders vasitəsilə alov, su, işıq simulyasiyaları.
