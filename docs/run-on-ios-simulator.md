# Запуск застосунку на iOS-симуляторі (macOS)

Покрокова інструкція з нуля. Перевірено на Expo SDK 54.

> ⚠️ **Expo Go більше НЕ підходить.** Проєкт використовує нативні модулі
> (Google Maps, Apple HealthKit / NitroModules), яких немає в Expo Go — звідси
> червоні екрани «NitroModules are not supported in Expo Go» та крах Maps.
> Запускай **dev build**:
> ```bash
> npx expo run:ios
> ```
> Кроки 5–6 нижче (через `exp://… ` в Expo Go) лишені для довідки, але для
> повного функціоналу потрібен саме dev build. Камера на симуляторі не працює
> в будь-якому разі — обирай фото з галереї.

## 1. Встановити Xcode
- App Store → знайти **Xcode** → встановити (велике завантаження, ~10+ ГБ).
- Відкрити Xcode хоча б раз, прийняти ліцензію.
- (За потреби) у терміналі:
  ```bash
  sudo xcodebuild -runFirstLaunch
  sudo xcodebuild -license accept
  ```

## 2. Встановити iOS-симулятор (runtime)
У нових версіях Xcode симулятор iOS НЕ йде в комплекті — його качають окремо.
- Xcode → **Settings…** (`Cmd + ,`) → вкладка **Components** (або **Platforms**) → біля **iOS** натиснути **Get / ➕**.
- Або в терміналі:
  ```bash
  xcodebuild -downloadPlatform iOS
  ```
- Перевірити, що зʼявились пристрої:
  ```bash
  xcrun simctl list devices available
  ```
  Має бути список iPhone. Якщо порожньо — runtime ще не встановлено.

## 3. Встановити залежності проєкту
```bash
npm install
```

## 4. Налаштувати `.env`
Створити `.env` у корені проєкту з ключами Supabase:
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```
(значення — у Supabase: Project Settings → API)

## 5. Запустити дев-сервер
```bash
npx expo start --localhost --port 8082
```
- `--localhost` змушує симулятор ходити через `127.0.0.1` — **обходить VPN** (інакше Expo дає LAN-IP типу `192.168.0.102`, який VPN ламає → «Could not connect to the server»).
- Лишити цей термінал працювати. Дочекатись `Waiting on http://localhost:8082`.

## 6. Відкрити застосунок у симуляторі
У **другому** терміналі:
```bash
xcrun simctl openurl booted exp://127.0.0.1:8082
```
Це відкриває застосунок в Expo Go **без AppleScript** — обходить помилку
`execution error: Не дозволено надсилати події Apple до System Events (-1743)`,
яка падає при натисканні клавіші `i`.

> Якщо симулятор ще не запущений — спершу відкрий його: Spotlight (`Cmd+Space`) → **Simulator**, дочекайся завантаження iPhone, потім виконай команду вище.

## Альтернатива: клавіша `i`
Якщо хочеш користуватись звичним `i` в Expo (замість кроку 6), треба видати дозвіл на автоматизацію:
- **System Settings → Privacy & Security → Automation** → знайти свій термінал → увімкнути **System Events**.
- (За потреби) **Privacy & Security → Accessibility** → додати термінал.

## Найпростіша альтернатива: реальний телефон
- Встановити **Expo Go** з App Store на айфон.
- `npx expo start` → відсканувати QR-код камерою.
- Не треба ні Xcode, ні дозволів macOS (телефон і Mac мають бути в одній мережі; з VPN можливі проблеми — тоді `npx expo start --tunnel`).

## Часті помилки
| Помилка | Причина / рішення |
|---|---|
| `No iOS devices available in Simulator.app` | Не встановлено iOS runtime → крок 2 |
| `Could not connect to the server` (exp://192.168.x.x) | VPN/мережа → запускати з `--localhost` (крок 5) |
| `execution error … System Events (-1743)` | Немає дозволу Automation → відкривати через `simctl` (крок 6) або видати дозвіл |
