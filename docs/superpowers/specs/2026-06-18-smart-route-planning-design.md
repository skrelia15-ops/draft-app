# Smart route planning (B + C) — дизайн-специфікація (MVP)

**Дата:** 2026-06-18
**Гілка:** feature/supabase-backend-auth
**Мета:** на екрані карти дати велосипедисту **персональний підбір маршруту на сьогодні**
за погодою, скілом і складністю дороги — окремо від спільного каталогу Explore.
Два направляючі режими за ✨-банером: **B «Маю куди їхати»** (оптимізувати шлях туди)
і **C «Порадь маршрут»** (підказати, куди). Ручне планування FROM→TO лишається дефолтом.

## Рішення (затверджені в брейнштормі)

1. **Точка входу** — плаваючий пілл **✨ «Підібрати маршрут на сьогодні»** над ручною
   шторкою на `app/ride/map.tsx`. Тап → панель `SmartPanel` знизу з направляючим
   вибором B / C. Ручна шторка не змінюється.
2. **Движок** — on-device скоринг **«Today Fit» (0–100)**, чиста функція. LLM відкладено
   (майбутній гібрид: скоринг ранжує, LLM лише дописує «чому»).
3. **C — джерело кандидатів — гібрид:** маршрути з Explore, що **реально поруч** і
   проходять критерії, **+** згенеровані схематичні петлі (`buildRoutePreview`) біля
   юзера як фолбек/доповнення, коли каталогу мало/далеко/не підходить.
4. **«Чому» показуємо одразу** на картці (теги), не по тапу.

## Non-goals (MVP)

- Жодного LLM/бекенду (тільки on-device).
- Згенеровані петлі — **схематичні** (через наявний `buildRoutePreview`), НЕ реальні
  дороги через роутинг.
- Не чіпаємо вкладку Explore і поведінку ручного планувальника.
- Без збереження/шерингу підібраних маршрутів, без багатоденного планування.

## 1. Движок «Today Fit»

`lib/ride/todayFit.ts` — чиста, тестована функція поряд із `compat.ts`/`conditions.ts`.

```ts
export type FitReason = { kind: 'wind' | 'difficulty' | 'distance' | 'weather'; good: boolean; text: string };
export type TodayFit = { score: number; tier: 'GREAT' | 'GOOD' | 'FAIR' | 'POOR'; reasons: FitReason[] };

export function scoreTodayFit(candidate: RouteCandidate, ctx: FitContext): TodayFit;
```

`FitContext = { conditions: Conditions; profile: Profile; targetDistanceKm?: number }`
(`conditions` з `deriveConditions(weather)`, `profile` з `useProfile`).

**Фактори й ваги** (нормуються до 0–100, прозоро задокументовані в коді):

| Фактор | Дані | Логіка |
|--------|------|--------|
| Вітер | `conditions.draftIndex`, `conditions.windFrom`, `candidate.bearing` | для `out-and-back`/`point-to-point`: попутний на основній нозі ↑, зустрічний ↓; для `loop` напрям нейтральний → спираємось на `draftIndex` (сила вітру) |
| Складність↔скіл | `candidate.difficulty`, `profile.skillLevel` | збіг рівня ↑; занадто складно для Novice ↓ (таблиця comfort) |
| Дистанція/час | `candidate.distanceKm`, `targetDistanceKm` (з `profile.avgPaceKmh` × час) | близькість до цілі ↑ |
| Погода | `conditions.isRaining`, `conditions.tempC` | дощ / екстремальна темп ↓ |

`reasons` містить 2–3 найвпливовіші пояснення (для тегів на картці). `tier` — смуга score.

## 2. Спільний кандидат: `RouteCandidate`

`lib/ride/routeCandidate.ts` — єдиний тип, на який мапляться всі джерела, щоб скоринг
був однаковий.

```ts
export type RouteCandidate = {
  id: string;
  name: string;
  shape: RouteShape;
  distanceKm: number;
  difficulty: 'EASY' | 'MODERATE' | 'HARD';
  paceKmh: number;
  coordinates: LatLng[];      // для mini-map прев'ю
  origin: LatLng;
  destination: LatLng;
  bearing: number;            // домінуючий курс основної ноги, градуси
  source: 'catalog' | 'generated' | 'directions';
};
```

Адаптери (чисті):
- `catalogToCandidate(route: CatalogRoute, origin, seed)` — використовує `buildRoutePreview` для координат (як Explore вже робить).
- `loopToCandidate(origin, distanceKm, seed)` — генерує петлю через `buildRoutePreview`.
- `directionsToCandidate(route: RouteResult, name)` — з результату Google для B.
- `dominantBearing(coords: LatLng[]): number` — курс від першої до серединної точки (для напряму вітру).

## 3. C — рекомендатор

`lib/ride/recommend.ts`:
```ts
export function recommendRoutes(args: {
  catalog: CatalogRoute[];
  origin: LatLng | null;
  conditions: Conditions;
  profile: Profile;
  targetDistanceKm?: number;
  maxResults?: number; // default 3
}): { candidate: RouteCandidate; fit: TodayFit }[];
```
Логіка:
1. З каталогу беремо ті, що **поруч** (radius від `origin`, якщо є) і грубо проходять
   критерії (дистанція в розумному діапазоні цілі).
2. Якщо релевантних < `maxResults` (або `origin` є, але каталог далеко) — **догенеровуємо**
   петлі `loopToCandidate` біля `origin` на цільову дистанцію (різні `seed`/shape), щоб
   добити до `maxResults`.
3. Скоримо всіх `scoreTodayFit`, сортуємо за `score`, повертаємо топ-N.
4. Якщо `origin` нема — ранжуємо лише каталог за неспаціальними факторами (без генерації);
   панель підкаже ввімкнути локацію (переюз патерну `PermissionGate`).

## 4. B — оптимізація до точки

У `SmartPanel` (режим B): юзер ввів точку (переюз існуючого autocomplete/pick-on-map зі
шторки або просте поле в панелі) → `getCyclingDirections(origin, dest)` (Google вже вертає
альтернативи; `RouteResult.alternativeCount`) → `directionsToCandidate` для кожної →
`scoreTodayFit` → показуємо найкращу + «чому» + перемикач на альтернативи. На START —
наявний `startRide` з координатами маршруту (як зараз робить ручна шторка).

## 5. UI

- `components/map/SmartBanner.tsx` — пілл «✨ Підібрати маршрут на сьогодні». Props:
  `onPress`. Стиль — `colors.surfaceElevated` + бордер `colors.primary` (як pick-banner).
- `components/map/SmartPanel.tsx` — нижня панель. Стан: вибір B/C → інпут → результати.
  - Заголовок-вибір: дві кнопки «📍 Маю куди їхати» / «✨ Порадь маршрут».
  - C-інпут: тривалість чіпами (30хв / 1год / 2год / будь-що) — переюз `Chip`.
  - Результати: список карток. Картка = mini-map прев'ю (як `RouteMiniMap` в Explore) +
    назва + `Today Fit %` + 2 теги «чому» (переюз `Tag`; кольори тегів — `colors.success`/
    `warning` через статус-семантику). Найкраща — бордер `colors.primary`.
  - Тап на картку → `startRide` (B/C однаково) або перехід на превʼю — узгодити в плані
    (MVP: одразу START, як ручна шторка).
- `app/ride/map.tsx` — рендерить `SmartBanner` (коли ручна шторка згорнута / завжди над
  нею) і `SmartPanel` (модально знизу) поряд із наявним станом. Тягне `useWeather` →
  `deriveConditions`, `useProfile`, `coords`. Ручна шторка/маркери/логіка — без змін.

## 6. Обробка помилок / порожніх станів

- **Нема локації:** C ранжує лише каталог (без генерації) + підказка ввімкнути GPS
  (переюз `PermissionGate`); B вимагає введену точку.
- **Нема погоди:** `FALLBACK_WEATHER` (як у `route-details.tsx`) → фактор вітру нейтральний.
- **Каталог порожній + нема локації:** порожній стан із підказкою.
- **Помилка directions у B:** тост + retry (переюз патерну помилки маршруту зі шторки).

## 7. Тестування

- `todayFit.test.ts` — попутний↑/зустрічний↓; невідповідність складність↔скіл↓; близькість
  дистанції до цілі↑; дощ↓. Перевірка меж `tier`.
- `recommend.test.ts` — лише-каталог; догенерація петель коли каталогу мало; порядок топ-N;
  поведінка без `origin`.
- `routeCandidate.test.ts` — `dominantBearing`, адаптери дають коректні поля.

## 8. Файлова структура

```
lib/ride/todayFit.ts          (+ todayFit.test.ts)
lib/ride/routeCandidate.ts     (+ routeCandidate.test.ts)
lib/ride/recommend.ts          (+ recommend.test.ts)
lib/ride/index.ts              (експорт нового)
components/map/SmartBanner.tsx
components/map/SmartPanel.tsx
app/ride/map.tsx               (інтеграція банера + панелі)
```

## Ризики

- **Скоринг вітру для петель** — напрям неінформативний; чесно спираємось на силу
  (`draftIndex`), не вигадуємо «вітер у спину» для loop.
- **Згенеровані петлі схематичні** — не реальні дороги; маркуємо джерело й не обіцяємо
  навігацію по них у MVP (START веде ride як зараз для catalog-прев'ю).
- **Перевантаження map.tsx** — панель/банер виносимо в `components/map/*` (екран лишається
  контейнером, як після рефактору).
