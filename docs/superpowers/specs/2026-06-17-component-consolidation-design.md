# Консолідація компонентів і токенів (Tier 2)

**Дата:** 2026-06-17
**Гілка:** feature/supabase-backend-auth
**Мета:** звести всі переюзні UI-компоненти в `components/`, додати відсутні токени й
розбити god-файли — щоб подальша робота (зокрема дизайн фічі підбору маршрутів)
брала готові компоненти з одного місця, а не дублювала їх.

## Принцип

**Це чистий рефактор — нуль змін у поведінці чи вигляді.** Кожен крок верифікується
`tsc --noEmit`; візуальний результат екранів лишається ідентичним. Якщо щось
вимагає зміни вигляду — це поза скоупом, виносимо окремо.

## Non-goals

- Не чіпаємо бізнес-логіку (`lib/*`), навігацію, дані.
- Не видаляємо Expo-шаблонні компоненти (`themed-text`, `hello-wave` тощо) — окрема прибирка.
- Не екстрактимо одноразові screen-only компоненти (EfficiencyGauge, PauseOverlay,
  SegmentTimeline, SlideContent, ChevronDecoration) — лишаються локальними.
- Жодних нових фіч.

## 1. Токени (`theme/colors.ts`)

Додати семантичні кольори (зараз хардкод у 2+ файлах) і бордер-оверлеї:

```ts
// Status (раніше хардкод #3FBF6E / #F2A93B / #E5484D у map.tsx, index.tsx)
success: '#3FBF6E',
warning: '#F2A93B',
danger:  '#E5484D',

// Hairline borders на темних картках (раніше rgba(255,255,255,0.06|0.08))
hairline:       'rgba(255,255,255,0.06)',
hairlineStrong: 'rgba(255,255,255,0.08)',

// Scrim для модальних оверлеїв (раніше rgba(17,17,17,0.6))
scrim: 'rgba(17,17,17,0.6)',
```

Замінити всі ~16 хардкод-входжень у `app/` + входження в `components/ui/draft/index.tsx`
на ці токени. Status-хелпери `riderColor` (map.tsx + index.tsx) звести в один
`statusColor(level)` у `lib/ride` або `theme`.

## 2. Розбити дизайн-систему на файли

`components/ui/draft/index.tsx` (642 рядки) → один-компонент-один-файл, з barrel:

```
components/ui/draft/
  Button.tsx        // PrimaryButton, SecondaryButton
  IconButton.tsx
  InputField.tsx
  Card.tsx          // CardShell, ElevatedCard, PrimaryCard, HighlightCard, ListItemCard
  StatCard.tsx
  Segmented.tsx     // SegmentedTabs, SegmentedProgress
  TabBar.tsx
  GoalsCard.tsx     // вже окремо
  toast-config.tsx  // вже окремо
  index.ts          // barrel: re-export усього (публічний API не змінюється)
```

Імпорти екранів (`@/components/ui/draft`) лишаються незмінними — barrel зберігає API.

## 3. Нові спільні примітиви (винести дублі)

| Компонент | Замінює | Файл |
|-----------|---------|------|
| `StatRow` / розширений `StatCard` | `Stat` (goals), `CoreStat` (insights), `StatRow` (route-details), `CompatBar` (index) | `components/ui/draft/StatCard.tsx` |
| `AvatarRing` | дубль аватара в profile.tsx + profile-setup.tsx | `components/ui/draft/AvatarRing.tsx` |
| `Tag` | `Tag` (route-details) + pill-бейджі | `components/ui/draft/Tag.tsx` |
| `Chip` | skill/bike чіпи (profile-setup) | `components/ui/draft/Chip.tsx` |

Кожен новий примітив параметризується так, щоб покрити всі поточні випадки без
зміни вигляду (звіряємо попіксельно через наявні стилі).

## 4. Розбити god-файли (Tier 2)

Co-located під-компоненти поряд з екраном; екран лишається entry-point.

**`app/ride/map.tsx` (1676 рядків) →** під-компоненти в `components/map/` (НЕ в `app/`,
бо Expo Router зробив би їх роутами):
```
app/ride/map.tsx                 // лишається: контейнер + стан + ефекти
components/map/BottomSheet.tsx
components/map/InputRow.tsx
components/map/PredictionsList.tsx
components/map/RouteSummary.tsx
components/map/PermissionGate.tsx
components/map/markers.tsx        // pins + rider markers + geo-хелпери (offsetCoords, compassBearing)
```

**`app/ride/insights.tsx` (672) →** `components/insights/` (CoreStat→StatCard, ComparisonBadge,
SplitBar, SegmentTimeline, SegmentCallout). SegmentTimeline/Callout — складні, але insights-only;
виносимо для розміру файлу, не для переюзу.

**`app/ride/active.tsx` (666) →** винести `EfficiencyGauge`, `PauseOverlay` у `components/active/`.

## 5. Порядок виконання (інкрементально, tsc після кожного)

1. Токени (крок 1) + заміна хардкоду. → tsc
2. Розбити barrel на файли (крок 2), API незмінний. → tsc
3. Нові примітиви + міграція дублів по черзі (StatCard → Avatar → Tag → Chip). → tsc після кожного
4. Розбити map.tsx → `components/map/*`. → tsc
5. Розбити insights.tsx, active.tsx. → tsc
6. Фінальний `tsc --noEmit` + ручний прогін екранів на dev build.

## Верифікація

- `npx tsc --noEmit` — зелений після кожного кроку.
- Існуючі тести (`*.test.ts`) проходять.
- Ручний візуальний прогін на `npx expo run:ios`: profile, profile-setup, explore,
  route-details, map, insights, active, goals — вигляд ідентичний до рефактору.

## Ризики

- **Expo Router false-routes:** під-компоненти в `app/` стануть роутами → виносимо в `components/`.
- **Попіксельні розбіжності** при злитті дублів → звіряємо стилі 1:1, не «покращуємо».
- Великий обсяг → робимо кроками з коментарем у комітах, кожен крок самодостатній.
