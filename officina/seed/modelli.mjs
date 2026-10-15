// Catalogo di partenza marche/modelli, dalla analisi dei dispositivi piu' diffusi in Italia/Europa (smartphone, tablet, PC e notebook).
// Formato: [tipo, marca, parole chiave (ricerca), [modelli...]]. Il campo "modello" e' quello che si legge sulla scatola.
// Il catalogo si carica da solo la prima volta (vedi modelli.mjs) e poi si modifica dalla sezione "Modelli" del gestionale.
export const MODEL_SEED = [
  ['smartphone', 'Apple', 'iphone ios', [
    'iPhone 6', 'iPhone 6 Plus', 'iPhone 6s', 'iPhone 6s Plus', 'iPhone 7', 'iPhone 7 Plus', 'iPhone 8', 'iPhone 8 Plus', 'iPhone SE (2016)', 'iPhone SE (2020)', 'iPhone SE (2022)',
    'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max', 'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
    'iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max', 'iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
    'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max', 'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
    'iPhone 16e', 'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'iPhone 17', 'iPhone 17 Air', 'iPhone 17 Pro', 'iPhone 17 Pro Max']],
  ['smartphone', 'Samsung', 'galaxy', [
    'Galaxy S8', 'Galaxy S9', 'Galaxy S9+', 'Galaxy S10', 'Galaxy S10e', 'Galaxy S10+', 'Galaxy S20', 'Galaxy S20 FE', 'Galaxy S20 Ultra', 'Galaxy S21', 'Galaxy S21 FE', 'Galaxy S21+', 'Galaxy S21 Ultra',
    'Galaxy S22', 'Galaxy S22+', 'Galaxy S22 Ultra', 'Galaxy S23', 'Galaxy S23 FE', 'Galaxy S23+', 'Galaxy S23 Ultra', 'Galaxy S24', 'Galaxy S24 FE', 'Galaxy S24+', 'Galaxy S24 Ultra', 'Galaxy S25', 'Galaxy S25 Edge', 'Galaxy S25 FE', 'Galaxy S25+', 'Galaxy S25 Ultra',
    'Galaxy A04s', 'Galaxy A05', 'Galaxy A05s', 'Galaxy A06', 'Galaxy A13', 'Galaxy A14', 'Galaxy A15', 'Galaxy A16', 'Galaxy A23', 'Galaxy A25', 'Galaxy A26', 'Galaxy A33', 'Galaxy A34', 'Galaxy A35', 'Galaxy A36', 'Galaxy A52', 'Galaxy A52s', 'Galaxy A53', 'Galaxy A54', 'Galaxy A55', 'Galaxy A56', 'Galaxy A71', 'Galaxy A72', 'Galaxy A73',
    'Galaxy M13', 'Galaxy M23', 'Galaxy M34', 'Galaxy M54', 'Galaxy J3', 'Galaxy J5', 'Galaxy J7', 'Galaxy Note 10', 'Galaxy Note 10+', 'Galaxy Note 20', 'Galaxy Note 20 Ultra',
    'Galaxy Z Flip3', 'Galaxy Z Flip4', 'Galaxy Z Flip5', 'Galaxy Z Flip6', 'Galaxy Z Fold3', 'Galaxy Z Fold4', 'Galaxy Z Fold5', 'Galaxy Z Fold6', 'Galaxy Xcover 5', 'Galaxy Xcover 6 Pro']],
  ['smartphone', 'Xiaomi', 'mi mui', [
    'Mi 9T', 'Mi 10T', 'Mi 10T Pro', 'Mi 11 Lite', 'Mi 11i', 'Xiaomi 11T', 'Xiaomi 11T Pro', 'Xiaomi 12', 'Xiaomi 12T', 'Xiaomi 12T Pro', 'Xiaomi 13', 'Xiaomi 13T', 'Xiaomi 13T Pro', 'Xiaomi 14', 'Xiaomi 14T', 'Xiaomi 14T Pro', 'Xiaomi 15', 'Xiaomi 15T',
    'Redmi 9', 'Redmi 9A', 'Redmi 9C', 'Redmi 10', 'Redmi 10C', 'Redmi 12', 'Redmi 12C', 'Redmi 13', 'Redmi 13C', 'Redmi A3', 'Redmi Note 8', 'Redmi Note 8 Pro', 'Redmi Note 9', 'Redmi Note 9 Pro', 'Redmi Note 10', 'Redmi Note 10 Pro', 'Redmi Note 10S',
    'Redmi Note 11', 'Redmi Note 11 Pro', 'Redmi Note 11S', 'Redmi Note 12', 'Redmi Note 12 Pro', 'Redmi Note 12 Pro+', 'Redmi Note 13', 'Redmi Note 13 Pro', 'Redmi Note 13 Pro+', 'Redmi Note 14', 'Redmi Note 14 Pro', 'Redmi Note 14 Pro+',
    'Poco X3 Pro', 'Poco X4 Pro', 'Poco X5', 'Poco X5 Pro', 'Poco X6', 'Poco X6 Pro', 'Poco X7', 'Poco X7 Pro', 'Poco F3', 'Poco F4', 'Poco F5', 'Poco F6', 'Poco F7', 'Poco M5', 'Poco M6', 'Poco C65']],
  ['smartphone', 'Huawei', 'emui', [
    'P20', 'P20 Lite', 'P20 Pro', 'P30', 'P30 Lite', 'P30 Pro', 'P40', 'P40 Lite', 'P40 Pro', 'P50 Pro', 'P60 Pro', 'P Smart 2019', 'P Smart 2021', 'P Smart Z',
    'Mate 20', 'Mate 20 Lite', 'Mate 20 Pro', 'Mate 30', 'Mate 30 Pro', 'Mate 40 Pro', 'Mate 50 Pro', 'Nova 9', 'Nova 10', 'Nova 11', 'Y5 2019', 'Y6 2019', 'Y6p', 'Y7 2019', 'Y7p', 'Y9 2019']],
  ['smartphone', 'Oppo', '', [
    'A15', 'A16', 'A17', 'A38', 'A58', 'A78', 'A79', 'A98', 'Reno 5', 'Reno 6', 'Reno 7', 'Reno 8', 'Reno 8T', 'Reno 10', 'Reno 11', 'Reno 12', 'Reno 13', 'Find X3 Lite', 'Find X3 Pro', 'Find X5', 'Find X5 Pro', 'Find X6 Pro', 'Find X8', 'Find N3 Flip']],
  ['smartphone', 'Realme', '', [
    'Realme 8', 'Realme 8 Pro', 'Realme 9', 'Realme 9 Pro', 'Realme 10', 'Realme 11', 'Realme 11 Pro', 'Realme 12', 'Realme 12 Pro', 'Realme 13', 'Realme 13 Pro', 'Realme 14', 'Realme C21', 'Realme C25', 'Realme C33', 'Realme C53', 'Realme C55', 'Realme C61', 'Realme C75', 'Realme GT 5', 'Realme GT 6', 'Realme GT Neo 3', 'Realme Narzo 50']],
  ['smartphone', 'Motorola', 'moto', [
    'Moto E7', 'Moto E13', 'Moto E14', 'Moto E22', 'Moto E32', 'Moto E40', 'Moto G7', 'Moto G8', 'Moto G9 Play', 'Moto G10', 'Moto G14', 'Moto G15', 'Moto G22', 'Moto G23', 'Moto G24', 'Moto G30', 'Moto G32', 'Moto G34', 'Moto G35', 'Moto G42', 'Moto G53', 'Moto G54', 'Moto G55', 'Moto G60', 'Moto G62', 'Moto G72', 'Moto G73', 'Moto G84', 'Moto G85', 'Moto G100',
    'Moto Edge 20', 'Moto Edge 30', 'Moto Edge 40', 'Moto Edge 40 Neo', 'Moto Edge 50', 'Moto Edge 50 Fusion', 'Moto Edge 50 Pro', 'Razr 40', 'Razr 40 Ultra', 'Razr 50', 'Razr 50 Ultra', 'One Fusion', 'One Vision']],
  ['smartphone', 'OnePlus', 'one plus', [
    'OnePlus 6T', 'OnePlus 7T', 'OnePlus 8', 'OnePlus 8T', 'OnePlus 9', 'OnePlus 9 Pro', 'OnePlus 10 Pro', 'OnePlus 10T', 'OnePlus 11', 'OnePlus 12', 'OnePlus 12R', 'OnePlus 13', 'OnePlus Nord', 'OnePlus Nord 2', 'OnePlus Nord 2T', 'OnePlus Nord 3', 'OnePlus Nord 4', 'OnePlus Nord CE 2', 'OnePlus Nord CE 3', 'OnePlus Nord CE 3 Lite', 'OnePlus Nord CE 4', 'OnePlus Nord N20', 'OnePlus Nord N30']],
  ['smartphone', 'Google', 'pixel', [
    'Pixel 4a', 'Pixel 5', 'Pixel 5a', 'Pixel 6', 'Pixel 6a', 'Pixel 6 Pro', 'Pixel 7', 'Pixel 7a', 'Pixel 7 Pro', 'Pixel 8', 'Pixel 8a', 'Pixel 8 Pro', 'Pixel 9', 'Pixel 9a', 'Pixel 9 Pro', 'Pixel 9 Pro XL', 'Pixel 9 Pro Fold', 'Pixel 10', 'Pixel 10 Pro']],
  ['smartphone', 'Honor', 'magic', [
    'Honor 8X', 'Honor 9X', 'Honor 10', 'Honor 10 Lite', 'Honor 20', 'Honor 20 Lite', 'Honor 50', 'Honor 70', 'Honor 90', 'Honor 90 Lite', 'Honor 200', 'Honor 200 Lite', 'Honor 200 Pro', 'Honor X6', 'Honor X7', 'Honor X8', 'Honor X8a', 'Honor X8b', 'Honor X9', 'Honor X9a', 'Honor X9b', 'Honor Magic 5 Lite', 'Honor Magic 5 Pro', 'Honor Magic 6 Lite', 'Honor Magic 6 Pro', 'Honor Magic 7 Pro', 'Honor Magic V2']],
  ['smartphone', 'Nokia', 'hmd', [
    'Nokia 2.4', 'Nokia 3.4', 'Nokia 5.4', 'Nokia 6.1', 'Nokia 7.2', 'Nokia 8.3', 'Nokia G10', 'Nokia G20', 'Nokia G21', 'Nokia G42', 'Nokia G60', 'Nokia X10', 'Nokia X20', 'Nokia C21', 'Nokia C32', 'Nokia 105', 'Nokia 110', 'Nokia 150', 'Nokia 225', 'Nokia 3310']],
  ['smartphone', 'Sony', 'xperia', [
    'Xperia XZ', 'Xperia XZ1', 'Xperia XZ2', 'Xperia XZ3', 'Xperia 1', 'Xperia 1 II', 'Xperia 1 III', 'Xperia 1 IV', 'Xperia 1 V', 'Xperia 1 VI', 'Xperia 5', 'Xperia 5 II', 'Xperia 5 III', 'Xperia 5 IV', 'Xperia 5 V', 'Xperia 10', 'Xperia 10 II', 'Xperia 10 III', 'Xperia 10 IV', 'Xperia 10 V', 'Xperia 10 VI']],
  ['smartphone', 'TCL', '', ['TCL 20 SE', 'TCL 30', 'TCL 40 SE', 'TCL 40 NxtPaper', 'TCL 50 SE']],
  ['smartphone', 'Vivo', '', ['Vivo Y21', 'Vivo Y33s', 'Vivo Y36', 'Vivo V25', 'Vivo V29', 'Vivo X80', 'Vivo X100']],
  ['smartphone', 'ZTE', 'nubia', ['Blade A52', 'Blade V40', 'Blade V50', 'Axon 30', 'Axon 40 Ultra', 'Nubia Red Magic 9 Pro']],
  ['smartphone', 'Asus', 'rog zenfone', ['Zenfone 8', 'Zenfone 9', 'Zenfone 10', 'Zenfone 11 Ultra', 'ROG Phone 6', 'ROG Phone 7', 'ROG Phone 8']],
  ['smartphone', 'Wiko', '', ['Wiko Y62', 'Wiko Y82', 'Wiko T10', 'Wiko Power U20', 'Wiko Hi Enjoy 60']],
  ['smartphone', 'Alcatel', '', ['Alcatel 1B', 'Alcatel 1S', 'Alcatel 3L', 'Alcatel 3X', 'Alcatel 1066', 'Alcatel 3082']],
  ['smartphone', 'Doogee', 'blackview ulefone', ['Doogee S61', 'Doogee V30', 'Blackview BV5200', 'Blackview BV9300', 'Ulefone Armor 21']],
  ['smartphone', 'Cat', 'caterpillar', ['Cat S62 Pro', 'Cat S75']],
  ['smartphone', 'Fairphone', '', ['Fairphone 3', 'Fairphone 4', 'Fairphone 5']],

  ['tablet', 'Apple', 'ipad ipados', [
    'iPad 6 (2018)', 'iPad 7 (2019)', 'iPad 8 (2020)', 'iPad 9 (2021)', 'iPad 10 (2022)', 'iPad 11 (2025)', 'iPad mini 4', 'iPad mini 5', 'iPad mini 6', 'iPad mini 7', 'iPad Air 2', 'iPad Air 3', 'iPad Air 4', 'iPad Air 5', 'iPad Air 11" (M2)', 'iPad Air 13" (M2)',
    'iPad Pro 9.7"', 'iPad Pro 10.5"', 'iPad Pro 11" (2018)', 'iPad Pro 11" (2020)', 'iPad Pro 11" (2021)', 'iPad Pro 11" (2022)', 'iPad Pro 11" (M4)', 'iPad Pro 12.9" (2018)', 'iPad Pro 12.9" (2020)', 'iPad Pro 12.9" (2021)', 'iPad Pro 12.9" (2022)', 'iPad Pro 13" (M4)']],
  ['tablet', 'Samsung', 'galaxy tab', [
    'Galaxy Tab A7', 'Galaxy Tab A7 Lite', 'Galaxy Tab A8', 'Galaxy Tab A9', 'Galaxy Tab A9+', 'Galaxy Tab S6 Lite', 'Galaxy Tab S7', 'Galaxy Tab S7 FE', 'Galaxy Tab S8', 'Galaxy Tab S8 Ultra', 'Galaxy Tab S9', 'Galaxy Tab S9 FE', 'Galaxy Tab S9 Ultra', 'Galaxy Tab S10+', 'Galaxy Tab S10 Ultra', 'Galaxy Tab Active 4 Pro']],
  ['tablet', 'Lenovo', 'tab', ['Tab M8', 'Tab M9', 'Tab M10', 'Tab M10 Plus', 'Tab M11', 'Tab P11', 'Tab P11 Pro', 'Tab P12', 'Tab P12 Pro', 'Yoga Tab 11', 'Yoga Tab 13', 'Legion Tab']],
  ['tablet', 'Huawei', 'matepad mediapad', ['MatePad T10', 'MatePad T10s', 'MatePad 10.4', 'MatePad 11', 'MatePad 11.5', 'MatePad Pro 11', 'MatePad Pro 12.6', 'MatePad SE', 'MediaPad T3', 'MediaPad T5', 'MediaPad M5']],
  ['tablet', 'Xiaomi', 'pad redmi', ['Xiaomi Pad 5', 'Xiaomi Pad 6', 'Xiaomi Pad 6 Pro', 'Xiaomi Pad 7', 'Redmi Pad', 'Redmi Pad SE', 'Redmi Pad Pro']],
  ['tablet', 'Microsoft', 'surface', ['Surface Go 2', 'Surface Go 3', 'Surface Go 4', 'Surface Pro 6', 'Surface Pro 7', 'Surface Pro 8', 'Surface Pro 9', 'Surface Pro 10', 'Surface Pro 11']],
  ['tablet', 'Amazon', 'fire kindle', ['Fire 7', 'Fire HD 8', 'Fire HD 10', 'Fire Max 11', 'Kindle Paperwhite', 'Kindle Oasis', 'Kindle Basic']],
  ['tablet', 'Alcatel', '', ['Alcatel 1T 7', 'Alcatel 1T 10', 'Alcatel 3T 8', 'Alcatel 3T 10']],
  ['tablet', 'Oppo', 'realme', ['Oppo Pad Air', 'Oppo Pad 2', 'Realme Pad', 'Realme Pad 2', 'Realme Pad Mini']],
  ['tablet', 'Honor', '', ['Honor Pad 8', 'Honor Pad 9', 'Honor Pad X8', 'Honor Pad X9', 'Honor MagicPad 2']],
  ['tablet', 'Acer', 'iconia', ['Iconia One 10', 'Iconia Tab 10', 'Acer Predator Tab']],

  ['portatile', 'Apple', 'macbook mac', [
    'MacBook Air 11" (2015)', 'MacBook Air 13" (2017)', 'MacBook Air 13" (2018)', 'MacBook Air 13" (2019)', 'MacBook Air 13" (2020, Intel)', 'MacBook Air 13" (M1)', 'MacBook Air 13" (M2)', 'MacBook Air 15" (M2)', 'MacBook Air 13" (M3)', 'MacBook Air 15" (M3)', 'MacBook Air 13" (M4)', 'MacBook Air 15" (M4)',
    'MacBook Pro 13" (2016-2019)', 'MacBook Pro 13" (2020, Intel)', 'MacBook Pro 13" (M1)', 'MacBook Pro 13" (M2)', 'MacBook Pro 14" (M1 Pro/Max)', 'MacBook Pro 14" (M2 Pro/Max)', 'MacBook Pro 14" (M3)', 'MacBook Pro 14" (M4)', 'MacBook Pro 15" (2015-2019)', 'MacBook Pro 16" (2019)', 'MacBook Pro 16" (M1 Pro/Max)', 'MacBook Pro 16" (M2 Pro/Max)', 'MacBook Pro 16" (M3 Pro/Max)', 'MacBook Pro 16" (M4 Pro/Max)', 'MacBook 12" (2017)']],
  ['portatile', 'HP', 'hewlett packard pavilion', [
    'HP 14', 'HP 15', 'HP 15s', 'HP 250 G8', 'HP 250 G9', 'HP 255 G8', 'HP 255 G9', 'HP Pavilion 14', 'HP Pavilion 15', 'HP Pavilion x360', 'HP Pavilion Gaming 15', 'HP Envy 13', 'HP Envy 15', 'HP Envy x360', 'HP Spectre x360 13', 'HP Spectre x360 14', 'HP Victus 15', 'HP Victus 16', 'HP Omen 15', 'HP Omen 16',
    'HP ProBook 440 G8', 'HP ProBook 450 G8', 'HP ProBook 450 G9', 'HP EliteBook 840 G8', 'HP EliteBook 840 G9', 'HP Chromebook 14', 'HP Stream 14', 'HP ZBook Firefly 14']],
  ['portatile', 'Dell', 'inspiron latitude xps', [
    'Inspiron 3511', 'Inspiron 3520', 'Inspiron 3530', 'Inspiron 5410', 'Inspiron 5520', 'Inspiron 5620', 'Inspiron 7610', 'Vostro 3510', 'Vostro 3520', 'Vostro 3530', 'Vostro 5410', 'Latitude 3420', 'Latitude 3520', 'Latitude 5420', 'Latitude 5520', 'Latitude 5530', 'Latitude 7420', 'Latitude 7430', 'XPS 13 9310', 'XPS 13 9315', 'XPS 13 Plus 9320', 'XPS 15 9510', 'XPS 15 9520', 'XPS 15 9530', 'XPS 17 9710', 'G15 5520', 'G15 5530', 'Alienware m15', 'Alienware x16', 'Precision 3561']],
  ['portatile', 'Lenovo', 'thinkpad ideapad yoga legion', [
    'IdeaPad 1', 'IdeaPad 3', 'IdeaPad 3 15ITL6', 'IdeaPad 5', 'IdeaPad 5 Pro', 'IdeaPad Slim 3', 'IdeaPad Slim 5', 'IdeaPad Flex 5', 'IdeaPad Gaming 3', 'V15 G3', 'V14 G3', 'V15 G4',
    'ThinkPad E14', 'ThinkPad E15', 'ThinkPad L14', 'ThinkPad L15', 'ThinkPad T14', 'ThinkPad T14s', 'ThinkPad T480', 'ThinkPad T490', 'ThinkPad X1 Carbon', 'ThinkPad X1 Yoga', 'ThinkPad X13', 'ThinkPad P1', 'ThinkBook 14', 'ThinkBook 15', 'Yoga 6', 'Yoga 7', 'Yoga 9i', 'Yoga Slim 7', 'Legion 5', 'Legion 5 Pro', 'Legion 7', 'LOQ 15', 'Chromebook Duet']],
  ['portatile', 'Asus', 'vivobook zenbook rog tuf', [
    'VivoBook 14', 'VivoBook 15', 'VivoBook 16', 'VivoBook Go 14', 'VivoBook Go 15', 'VivoBook S 14', 'VivoBook S 15', 'VivoBook Pro 15', 'ZenBook 13', 'ZenBook 14', 'ZenBook 14 OLED', 'ZenBook 15', 'ZenBook Duo', 'ZenBook Flip', 'ExpertBook B1', 'ExpertBook B5',
    'TUF Gaming A15', 'TUF Gaming F15', 'TUF Gaming F17', 'ROG Strix G15', 'ROG Strix G16', 'ROG Strix Scar 15', 'ROG Zephyrus G14', 'ROG Zephyrus G15', 'ROG Flow X13', 'Chromebook CX1']],
  ['portatile', 'Acer', 'aspire swift nitro predator', [
    'Aspire 1', 'Aspire 3', 'Aspire 3 A315', 'Aspire 5', 'Aspire 5 A515', 'Aspire 7', 'Aspire Vero', 'Swift 1', 'Swift 3', 'Swift 5', 'Swift Go 14', 'Swift X', 'Extensa 15', 'TravelMate P2', 'TravelMate P4', 'Nitro 5', 'Nitro V 15', 'Predator Helios 300', 'Predator Helios Neo 16', 'Predator Triton 500', 'Spin 3', 'Spin 5', 'Chromebook 314', 'Chromebook Spin 514']],
  ['portatile', 'MSI', 'katana modern stealth', [
    'Modern 14', 'Modern 15', 'Prestige 14', 'Prestige 15', 'Summit E13', 'Katana GF66', 'Katana 15', 'Katana 17', 'Cyborg 15', 'Thin GF63', 'Thin 15', 'Sword 15', 'Stealth 15M', 'Stealth 16', 'Vector GP66', 'Raider GE76', 'Titan GT77', 'Creator Z16', 'Pulse 15']],
  ['portatile', 'Microsoft', 'surface', ['Surface Laptop 3', 'Surface Laptop 4', 'Surface Laptop 5', 'Surface Laptop 6', 'Surface Laptop 7', 'Surface Laptop Go', 'Surface Laptop Go 2', 'Surface Laptop Go 3', 'Surface Book 3']],
  ['portatile', 'Samsung', 'galaxy book', ['Galaxy Book 3', 'Galaxy Book 4', 'Galaxy Book 4 Pro', 'Galaxy Book 4 Pro 360', 'Galaxy Book2 Pro', 'Galaxy Chromebook']],
  ['portatile', 'Huawei', 'matebook', ['MateBook D14', 'MateBook D15', 'MateBook D16', 'MateBook 14', 'MateBook 14s', 'MateBook X Pro', 'MateBook X Pro (2024)']],
  ['portatile', 'Xiaomi', 'redmibook', ['RedmiBook 15', 'RedmiBook Pro 15', 'Xiaomi Book 14', 'Xiaomi Notebook Pro']],
  ['portatile', 'Toshiba', 'dynabook', ['Satellite Pro C50', 'Tecra A50', 'Portege X30', 'Dynabook Satellite Pro']],
  ['portatile', 'Medion', 'akoya', ['Akoya E15', 'Akoya E17', 'Akoya S15', 'Erazer Crawler']],
  ['portatile', 'Gigabyte', 'aorus', ['G5', 'G6', 'Aorus 15', 'Aorus 17', 'Aero 14', 'Aero 16']],
  ['portatile', 'LG', 'gram', ['Gram 14', 'Gram 15', 'Gram 16', 'Gram 17', 'Gram Pro']],
  ['portatile', 'Razer', 'blade', ['Blade 14', 'Blade 15', 'Blade 16', 'Blade 18', 'Blade Stealth 13']],
  ['portatile', 'Chuwi', '', ['HeroBook Pro', 'GemiBook Pro', 'CoreBook X', 'Minibook X']],

  ['pc', 'HP', 'hewlett packard desktop', ['HP 290 G4', 'HP Pavilion Desktop TP01', 'HP Slim Desktop S01', 'HP ProDesk 400 G7', 'HP EliteDesk 800 G6', 'HP EliteDesk 800 G8', 'HP Z2 Tower G9', 'HP Omen 25L', 'HP Omen 40L', 'HP Victus 15L', 'HP All-in-One 24', 'HP Envy All-in-One 34']],
  ['pc', 'Dell', 'optiplex', ['OptiPlex 3080', 'OptiPlex 3090', 'OptiPlex 5090', 'OptiPlex 7090', 'OptiPlex 7010', 'Vostro 3888', 'Inspiron Desktop 3910', 'XPS Desktop 8950', 'Precision 3660', 'Alienware Aurora R15', 'Inspiron All-in-One 24']],
  ['pc', 'Lenovo', 'thinkcentre ideacentre', ['ThinkCentre M70q', 'ThinkCentre M70s', 'ThinkCentre M720', 'ThinkCentre M75q', 'ThinkCentre M90q', 'IdeaCentre 3', 'IdeaCentre 5', 'IdeaCentre AIO 3', 'Legion Tower 5', 'ThinkStation P3']],
  ['pc', 'Apple', 'mac imac', ['Mac mini (2018)', 'Mac mini (M1)', 'Mac mini (M2)', 'Mac mini (M4)', 'iMac 21.5"', 'iMac 24" (M1)', 'iMac 24" (M3)', 'iMac 24" (M4)', 'iMac 27"', 'Mac Studio', 'Mac Pro']],
  ['pc', 'Asus', 'rog', ['ExpertCenter D5', 'ExpertCenter D7', 'ROG Strix GA15', 'ROG Strix GT15', 'Vivo AiO V241', 'Mini PC PN64', 'NUC 13 Pro']],
  ['pc', 'Acer', 'aspire veriton', ['Aspire TC-1660', 'Aspire C24', 'Veriton X2690G', 'Veriton S4690G', 'Predator Orion 3000', 'Nitro 50']],
  ['pc', 'MSI', 'pro', ['PRO DP21', 'PRO AP242', 'MAG Infinite', 'MEG Trident X', 'Codex R']],
  ['pc', 'Assemblato', 'custom desktop pc fisso', ['PC assemblato Intel', 'PC assemblato AMD', 'PC gaming assemblato', 'PC ufficio assemblato', 'Mini PC']],

  ['console', 'Sony', 'playstation ps', ['PlayStation 4', 'PlayStation 4 Slim', 'PlayStation 4 Pro', 'PlayStation 5', 'PlayStation 5 Slim', 'PlayStation 5 Pro', 'DualShock 4', 'DualSense']],
  ['console', 'Microsoft', 'xbox', ['Xbox One', 'Xbox One S', 'Xbox One X', 'Xbox Series S', 'Xbox Series X', 'Controller Xbox']],
  ['console', 'Nintendo', 'switch', ['Switch', 'Switch Lite', 'Switch OLED', 'Switch 2', 'Joy-Con', '3DS', 'Wii U']],
  ['console', 'Valve', 'steam deck', ['Steam Deck LCD', 'Steam Deck OLED']],
  ['console', 'Asus', 'rog ally', ['ROG Ally', 'ROG Ally X']],
];

export const MODEL_SEED_COUNT = MODEL_SEED.reduce((a, g) => a + g[3].length, 0);
