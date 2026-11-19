# drawalg

drawio.com sitesinin kendi algoritma syntax'ıma göre kolaylaştırılmış uygulama hali.

drawalg, resmi açık kaynak **draw.io masaüstü uygulamasının** üzerine kurulu bir eklentidir.
draw.io'nun her özelliği (kaydet/aç, PNG/PDF/SVG dışa aktar, sayfalar, geri al…) aynen çalışır;
üstüne algoritma akış diyagramı için şunlar eklenir:

- **Algoritma paleti**: TANIMLA, OKU, İŞLEM, YAZDIR, İF, FOR, WHILE
- **Otomatik START / STOP**: her yeni sayfa elips içinde START ile başlar, STOP ile biter
- **Otomatik oklar ve yerleşim**: eklediğin her adım akışa yerleşir, oklar kendiliğinden bağlanır,
  İF'in False/True dalları alta birleşir, FOR ve WHILE'ın gövdesi sağda döner

## Web demosu

Aynı uygulama tarayıcıda da çalışır (kurulum gerektirmez).

**Yerelde denemek için:**

```bash
npm run build-web   # web-dist/ klasörünü üretir (draw.io kaynağı yoksa indirir)
npm run serve-web   # http://localhost:8080
```

**İnternette yayınlamak için (GitHub Pages, ücretsiz):**

```
https://kano008.github.io/drawalg/
```



## Kurulum

Gerekenler: [Node.js 22.12+](https://nodejs.org) ve git.

```bash
npm run setup
```

Bu komut draw.io masaüstü kaynağını (`vendor/` klasörüne, sürüm `v32.6.10`) indirir ve bağımlılıkları kurar.

## Çalıştırma

```bash
npm start
```

İstersen çift tıklanarak açılan bir uygulama da üretebilirsin:

```bash
npm run dist
```

macOS'ta çıktı `vendor/drawio-desktop/dist/mac-arm64/drawalg.app` (Intel Mac'te `dist/mac/`) olur; Uygulamalar klasörüne sürükleyebilirsin.


## Kullanım

| Şekil | Anlamı |
|---|---|
| Elips | START / STOP (otomatik) |
| Paralelkenar | TANIMLA — değişken tanımlama |
| Kesik köşeli kart | OKU — kullanıcıdan değer okuma |
| Dikdörtgen | İŞLEM — işlem / atama |
| Dalgalı alt kenarlı belge | YAZDIR — ekrana yazdırma |
| Baklava | İF — karar (False solda, True sağda) |
| Üç bölmeli kutu | FOR — döngü `for (ifade1; ifade2; ifade3)`: üst sol başlangıç, üst sağ artış, alt koşul |
| Baklava + geri dönen ok | WHILE — döngü: koşul True oldukça sağdaki gövde çalışır, False ile aşağı çıkılır |

- **Tıkla**: paletteki şekle tıklayınca seçili şeklin hemen altına eklenir. Hiçbir şey seçili değilse STOP'tan önceye eklenir.
- **Oka ekle**: bir oku seçip şekle tıklarsan şekil o okun yerine girer. Paletten sürükleyip bir okun üzerine de bırakabilirsin.
- **İF / FOR / WHILE içine ekleme**: False ya da True okunu (veya döngü gövdesinin okunu) seçip şekle tıkla.
- **Yazı**: yeni eklenen şekil seçili gelir; doğrudan yazmaya başla. Sonradan değiştirmek için çift tıkla. Yazı uzadıkça şekil genişler.
- **Silme**: şekli seç, Delete. Oklar kendiliğinden yeniden bağlanır. İF/FOR/WHILE silinince içindekiler de silinir (Ctrl/Cmd+Z ile geri alınır).
- Şekiller elle taşınamaz; yerleşimi drawalg yapar. Varsayılan çizgi kalınlığı 2, yazı boyutu 14'tür; renk, kalınlık, yazı tipi gibi elle yaptığın biçimlendirmeler korunur.
- Diğer draw.io kütüphaneleri ilk açılışta gizlenir; sol alttaki **+ More Shapes** ile geri açılabilir.

`examples/` klasöründe `examplediagrams/` içindeki örneklerin drawalg ile çizilmiş halleri var (File → Open ile açılabilir).
