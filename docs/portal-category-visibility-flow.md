# Флоу приховування карток (Category Display) у порталі

## 1. Джерело логіки та ключі

**Файл:** `lib/portal-category-visibility.ts`

- **Ключі видимості (4 категорії):** `Retirement`, `Group Life`, `Group Health`, `Other` (з `lib/service-categories.ts` → `PRIMARY_SERVICE_CATEGORY_OPTIONS`).
- **getCategoryPortalVisibility(raw)** — нормалізує збережене значення до об’єкта з цими 4 ключами; `null/undefined` → усі `true`.
- **isCategoryVisibleInPortal(category, visibility)** — для **тілів бенефітів** (назва категорії картки): чи показувати категорію; мапить "Retirement Plan Benefits", "Health Insurance" тощо на ці 4 ключі.
- **getContactCategories(contact)** — витягує категорії з контакту (`benefitsCategory`, `benefitsCategories`, `category` тощо) і нормалізує до тих самих ключів.
- **isContactVisibleInPortal(benefitsCategories, visibility)** — для **контактів**: показувати, якщо хоча б одна категорія контакту видима.
- **filterContactsByPortalVisibility(contacts, visibility)** — фільтрує масив контактів за `visibility`.

---

## 2. Де задається видимість (Show/Hide)

### 2.1 Step 5 візарда (Employee Portal → Category Display)

**Файл:** `components/wizard/new-client-steps/step-5-employee-portal/step-5d.tsx`

- UI: перемикачі Show/Hide для кожної категорії (бл. 1543–1547).
- При зміні викликається **handleCategoryPortalVisibilityChange(category, checked)** (бл. 1279–1302):
  - оновлює локальний стейт `categoryPortalVisibility`;
  - **saveStepDataLocally("employeePortalPreview", flatPayload)** — у стейт візарда (Zustand);
  - **saveStepDataToServer("employeePortalPreview", flatPayload)** — POST у API.

**API збереження в сесію візарда:**  
`app/api/new-client-wizard/employee-portal-preview/route.ts` (POST)

- Тіло запиту зберігається в `NewClientEmployeePortalPreview.previewData` (поле `previewData` = плоский об’єкт з `categoryPortalVisibility`).

**Перенесення з сесії в клієнта при Complete Setup:**  
`app/api/new-client-wizard/complete-v2/route.ts` (бл. 288–296)

- Читає `wizardSession.employeePortalPreview.previewData.categoryPortalVisibility` (підтримка плоского і вкладеного формату).
- При створенні клієнта в `prisma.client.create` передає **categoryPortalVisibility: getCategoryPortalVisibility(...)**.

### 2.2 Edit Client (Category Display + Save)

**Файл:** `app/new/edit-client/[id]/page.tsx`

- Секція Category Display з перемикачами (бл. 1272–1275).
- Стейт і збереження через **useEditClient**.

**Файл:** `hooks/useEditClient.ts`

- Стейт: `categoryPortalVisibility` (бл. 150, 352).
- При **handleSave** (бл. 852) у payload відправляється **categoryPortalVisibility: getCategoryPortalVisibility(categoryPortalVisibility)**.

**API збереження в клієнта:**  
`app/api/clients/[id]/route.ts` (PUT, бл. 285–288)

- Приймає `categoryPortalVisibility` з body, нормалізує через `getCategoryPortalVisibility`, зберігає в `Client.categoryPortalVisibility`.

---

## 3. Як працює перевірка Hide — чи є поле в контактах у БД?

**Ні.** У контактів у БД **немає поля "hide"**. Приховування — це не властивість контакту, а **налаштування категорії на клієнті**.

- **У контакта** (в `Client.keyContacts.contacts[]` або в масиві) є лише **категорія**:
  - `benefitsCategory` або `benefitsCategories` (наприклад `"Retirement"`, `"Retirement Plan Benefits"`, `"Health Insurance"`).
- **У клієнта** (в БД) зберігається **об’єкт видимості категорій**:
  - `Client.categoryPortalVisibility` (Json) — наприклад `{ "Retirement": false, "Group Life": true, "Group Health": true, "Other": true }`.
  - Тобто «які категорії показувати в порталі», а не «який контакт прихований».

**Перевірка «чи прихований контакт»:**

1. Взяти категорії контакту: `getContactCategories(contact)` → напр. `["Retirement"]`.
2. Взяти видимість з клієнта: `visibility = getCategoryPortalVisibility(client.categoryPortalVisibility)`.
3. Контакт **прихований**, якщо **жодна** з його категорій не видима: `visibility[key] === false` для всіх ключів, що відповідають категоріям контакту.
   Тобто: контакт з категорією Retirement прихований, коли `visibility["Retirement"] === false`.
4. **Виняток:** якщо **всі 4 категорії приховані** (типовий стан нового плану, `HIDDEN_CATEGORY_PORTAL_VISIBILITY`), контакти **все одно показуються**. Перемикачі Show/Hide приховують контакти лише певної категорії, коли хоча б одна інша категорія залишається видимою.

Це реалізовано в `lib/portal-category-visibility.ts`: **isContactVisibleInPortal(benefitsCategories, visibility)** і **isContactHiddenByCategory** на сторінці My Benefits Team.

---

## 4. Де зберігається видимість

| Місце | Модель/поле | Коли |
|-------|-------------|------|
| Сесія візарда | `NewClientEmployeePortalPreview.previewData` (JSON, ключ `categoryPortalVisibility`) | Під час Step 5 при кожному перемиканні Show/Hide |
| Клієнт (БД) | `Client.categoryPortalVisibility` (Json) | Після Complete Setup або після Save в Edit Client |

---

## 5. Що саме відбувається при натисканні Hide і як картка ховається в My Benefits Team

### 4.1 Натискаємо Hide (два варіанти)

**Варіант A: Hide у Step 5 візарда**

1. **UI:** `step-5d.tsx` — Switch для категорії (наприклад Retirement) → `onCheckedChange` викликає `handleCategoryPortalVisibilityChange("Retirement", false)`.
2. **Обробник (step-5d.tsx, ~1280–1297):**
   - `next = { ...prev, [category]: false }` → у стейті тепер `Retirement: false`.
   - `flatPayload = { ...previewContent, categoryPortalVisibility: next }` — один об’єкт з оновленим `categoryPortalVisibility`.
   - `saveStepDataLocally("employeePortalPreview", flatPayload)` — оновлює Zustand-стейт візарда (без запиту).
   - `saveStepDataToServer("employeePortalPreview", flatPayload)` — **відправляє POST на сервер**.
3. **Сервер:** `POST /api/new-client-wizard/employee-portal-preview` (`employee-portal-preview/route.ts`):
   - Бере поточну сесію візарда + існуючий `employeePortalPreview.previewData`.
   - **Merge:** `toStore = { ...existingPreviewData, ...incoming }` — вхідний `categoryPortalVisibility` не затирає benefits та інші поля.
   - `prisma.newClientEmployeePortalPreview.upsert` — зберігає `previewData: toStore` у таблицю **NewClientEmployeePortalPreview** (прив’язка до сесії візарда).
4. **Клієнт у БД поки не змінюється.** Запис у **Client** відбудеться лише після **Complete Setup** (complete-v2 читає `previewData.categoryPortalVisibility` і передає в `prisma.client.create`).

**Варіант B: Hide в Edit Client**

1. **UI:** `edit-client/[id]/page.tsx` — перемикач Category Display → зміна стейту в `useEditClient` (`categoryPortalVisibility`).
2. Користувач натискає **Save** → `handleSave` у `useEditClient.ts` збирає payload і робить **PUT** `/api/clients/${clientId}` з полем `categoryPortalVisibility`.
3. **Сервер:** `PUT /api/clients/[id]` — витягує `categoryPortalVisibility` з body, нормалізує через `getCategoryPortalVisibility`, записує в **Client.categoryPortalVisibility** у БД.

Тобто: у візарді Hide лише зберігається в **сесію візарда** (POST); у клієнта це потрапляє після **Complete Setup**. В Edit Client Hide потрапляє в **клієнта** одразу після **Save** (PUT).

### 4.2 Як саме приховується картка на My Benefits Team

My Benefits Team показує дані **лише з клієнта** (GET `/api/clients/[id]`). Візард-сесія там не використовується.

1. **Відкриття сторінки:** `my-benefits-team/page.tsx` підвантажує клієнта через `useClientPortal()` → `clientData` (при монті викликається `refetch()`, тож дані свіжі).
2. **Контакты:** беруться з `clientData.keyContacts.contacts` (або масив у старому форматі) — це один список усіх контактів клієнта.
3. **Visibility:** з того ж `clientData`:
   - `visibility = getCategoryPortalVisibility(clientData.categoryPortalVisibility ?? clientData.employeePortalPreview?.categoryPortalVisibility)`.
   - Якщо в клієнта збережено `Retirement: false`, то `visibility["Retirement"] === false`.
4. **Фільтрація (приховування):**
   - Для кожного контакту викликається `getContactCategoriesFromLib(c)` → категорії контакту (наприклад `["Retirement"]` або `["Retirement Plan Benefits"]` → нормалізуються до `["Retirement"]`).
   - Потім `isContactVisibleInPortal(categories, visibility)`: якщо хоча б одна категорія контакту має `visibility[key] !== false`, контакт видимий; інакше — прихований.
   - Для Retirement з `visibility["Retirement"] === false` контакт з категорією Retirement не проходить фільтр.
5. **Результат:** `visibleContacts = contacts.filter(...)` — у масиві лишаються тільки контакти з видимими категоріями. Рендер карток (primary, large, small) використовує **тільки** `visibleContacts`, тому картка з прихованою категорією **не малюється**.

Підсумок: кнопка Hide оновлює видимість на сервері (сесія візарда або клієнт); My Benefits Team **нічого не видаляє з БД** — вона лише фільтрує вже завантажені контакти по `clientData.categoryPortalVisibility` перед виводом. Якщо в клієнта збережено приховану категорію (після Complete Setup або після Save в Edit Client), картки цієї категорії не показуються.

---

## 6. Де читається видимість для порталу

**API:** `app/api/clients/[id]/route.ts` (GET, бл. 60–72)

- `rawVisibility = client.categoryPortalVisibility ?? client.employeePortalPreview?.categoryPortalVisibility`
- У відповідь завжди додається **categoryPortalVisibility: getCategoryPortalVisibility(rawVisibility)** (нормалізований об’єкт з 4 ключами).

Дані клієнта (включно з `categoryPortalVisibility`) для порталу тягнуться через контекст:

**Файл:** `contexts/client-portal-context.tsx`

- **fetchClient()** — GET `/api/clients/${clientId}` (при refetch з cache-bust: `?t=...`).
- У контекст віддається **clientData** (туди входить і `categoryPortalVisibility` з API).

---

## 7. Де фільтруються контакти та бенефіти і як вони виводяться

### 5.1 My Benefits Team (картки контактів)

**Файл:** `app/new/view/[id]/my-benefits-team/page.tsx`

- **Дані:** `clientData` з `useClientPortal()` (той самий GET клієнта).
- **Контакты:** `clientData.keyContacts.contacts` (або масив у старому форматі), фільтр `showOnPortal !== false`.
- **Visibility (бл. 81–94):**
  `visibility = getCategoryPortalVisibility(clientData.categoryPortalVisibility ?? clientData.employeePortalPreview?.categoryPortalVisibility)`.
- **Фільтрація (бл. 95–110):**
  **visibleContacts** = `contacts.filter(c => isContactVisibleInPortal(getContactCategoriesFromLib(c), visibility))`.
- **Рендер:** усі картки (primary, large, small) рендеряться тільки з **visibleContacts** (бл. 111–112, далі передача в layout-компоненти).

Тобто приховування контактів відбувається саме тут: один список контактів → один відфільтрований список → один вивід.

> **Важливо:** контакти показуються навіть коли **всі 4 категорії приховані** (типовий стан нового плану). Перемикачі Show/Hide приховують лише контакти конкретної прихованої категорії, якщо хоча б одна інша категорія залишається видимою. Тобто новий план одразу показує доданих ключових контактів, навіть поки бенефіт-хаби ще не опубліковані.

### 5.2 Головна сторінка порталу (хаб + контакти в порталі)

**Файл:** `app/new/view/[id]/page.tsx`

- **Дані:** `clientData` з `useClientPortal()`.
- **Контакты (бл. 36–54):** з `clientData.keyContacts`, фільтр `showOnPortal !== false`.
- **Visibility (бл. 58–65):** той самий підхід, **categoryVisibility = getCategoryPortalVisibility(rawVisibility)**.
- **Фільтрація контактів (бл. 66–68):**  
  **visibleContacts = filterContactsByPortalVisibility(visibleContacts, categoryVisibility)**.
- **Вивід:** у **ClientPortal** передається вже відфільтрований список: **keyContacts: visibleContacts** (бл. 108), **categoryPortalVisibility: categoryVisibility** (бл. 111).

**Файл:** `components/pages/client-portal/client-portal.tsx` (бл. 150)

- Прокидує **categoryPortalVisibility** у дочірні секції (зокрема в **PortalHeader** і блок бенефітів).

### 5.3 Тілі бенефітів (картки категорій: Retirement, Health тощо)

**Файл:** `components/pages/client-portal/sections/portal-benefits.tsx`

- **Пропс:** `categoryPortalVisibility` (бл. 25, 38).
- **Фільтрація (бл. 152–157):**  
  **displayBenefits** = benefits.filter(benefit =>  
  - **isCategoryVisibleInPortal(benefit.category || benefit.title, categoryPortalVisibility)** — якщо категорія прихована, картка не показується;  
  - далі перевірки `isEnabled`, completeness тощо.
- **Вивід:** рендеряться лише **displayBenefits**.

### 5.4 Хедер порталу (навігація по категоріях)

**Файл:** `components/pages/client-portal/sections/portal-header.tsx` (бл. 59–62)

- Отримує **categoryPortalVisibility**, нормалізує через **getCategoryPortalVisibility** і приховує пункти навігації для прихованих категорій.

### 5.5 Сторінки категорій (Retirement, Health, Life, Wellness тощо)

**Файли:**

- `app/new/view/[id]/retirement/page.tsx` — фільтр документів за **isCategoryVisibleInPortal** (бл. 121–127).
- `app/new/view/[id]/health-insurance/page.tsx`, `life-insurance/page.tsx`, `wellness-programs/page.tsx`, `materials/page.tsx` — передають **categoryPortalVisibility** у компоненти (наприклад, у секції документів).

### 5.6 Документи (фільтр по категорії)

**Файл:** `components/pages/client-portal/sections/documents-section.tsx` (бл. 634)

- **isCategoryVisibleInPortal(doc.category, categoryPortalVisibility)** — приховані категорії не показують документи.

---

## 8. Схема флоу (коротко)

```
[Запис видимості]
  Step 5 (step-5d.tsx)  →  handleCategoryPortalVisibilityChange
    → saveStepDataToServer("employeePortalPreview", flatPayload)
    → POST /api/new-client-wizard/employee-portal-preview  →  NewClientEmployeePortalPreview.previewData

  Complete Setup (complete-v2)  →  читає previewData.categoryPortalVisibility
    → prisma.client.create({ ..., categoryPortalVisibility })

  Edit Client (useEditClient + page)  →  handleSave
    → PUT /api/clients/[id]  { categoryPortalVisibility }  →  Client.categoryPortalVisibility

[Читання для порталу]
  GET /api/clients/[id]  →  categoryPortalVisibility = getCategoryPortalVisibility(
    client.categoryPortalVisibility ?? client.employeePortalPreview?.categoryPortalVisibility
  )
  → у відповіді завжди data.categoryPortalVisibility (нормалізований)

  ClientPortalProvider  →  fetchClient()  →  clientData  (включно з categoryPortalVisibility)

[Фільтрація та вивід]
  My Benefits Team (page)     → visibility з clientData → visibleContacts (filter isContactVisibleInPortal) → рендер карток
  Portal hub (page.tsx)      → visibleContacts = filterContactsByPortalVisibility(...) → ClientPortal keyContacts
  portal-benefits.tsx        → displayBenefits (filter isCategoryVisibleInPortal по category) → рендер тілів
  portal-header.tsx          → приховування пунктів навігації по visibility
  documents-section.tsx      → фільтр документів по isCategoryVisibleInPortal(doc.category, ...)
  retirement/page.tsx        → фільтр документів по isCategoryVisibleInPortal
```

---

## 9. Файли за призначенням

| Що | Файли |
|----|--------|
| Логіка видимості, маппінг категорій | `lib/portal-category-visibility.ts` |
| Ключі категорій (4 назви) | `lib/service-categories.ts` (PRIMARY_SERVICE_CATEGORY_OPTIONS) |
| Запис у візарді (Step 5) | `components/wizard/new-client-steps/step-5-employee-portal/step-5d.tsx` |
| API збереження в сесію візарда | `app/api/new-client-wizard/employee-portal-preview/route.ts` |
| Запис у клієнта при Complete | `app/api/new-client-wizard/complete-v2/route.ts` |
| Запис у клієнта в Edit Client | `hooks/useEditClient.ts`, `app/api/clients/[id]/route.ts` (PUT) |
| Читання для порталу | `app/api/clients/[id]/route.ts` (GET) |
| Контекст порталу (clientData) | `contexts/client-portal-context.tsx` |
| Фільтр контактів + рендер карток | `app/new/view/[id]/my-benefits-team/page.tsx` |
| Фільтр контактів на хабі | `app/new/view/[id]/page.tsx` |
| Фільтр тілів бенефітів | `components/pages/client-portal/sections/portal-benefits.tsx` |
| Навігація в хедері | `components/pages/client-portal/sections/portal-header.tsx` |
| Фільтр документів | `components/pages/client-portal/sections/documents-section.tsx`, `app/new/view/[id]/retirement/page.tsx` |
| UI Show/Hide в Edit Client | `app/new/edit-client/[id]/page.tsx` |

Цього достатньо, щоб простежити весь шлях приховування від вибору Show/Hide до фільтрації та виводу карток і документів.
