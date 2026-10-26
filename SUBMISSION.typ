#set page(
  paper: "a4",
  margin: (x: 1.2cm, top: 1.0cm, bottom: 1.0cm),
)
#set text(
  font: ("Inter", "DejaVu Sans"),
  size: 8.5pt,
  lang: "ru",
)

#let alfa-red = rgb("#ef3124")
#let dark-bg = rgb("#0f172a")
#let light-gray = rgb("#f8fafc")
#let border-gray = rgb("#e2e8f0")

// Header
#grid(
  columns: (1fr, auto),
  align: (left + horizon, right + horizon),
  [
    #text(size: 8pt, weight: "bold", fill: alfa-red, tracking: 0.1em)[ХАКАТОН «АЛЬФА-БУДУЩЕЕ 2026» · ТРЕК: МАЛЫЙ И МИКРОБИЗНЕС] \
    #v(1pt)
    #text(size: 15pt, weight: "bold", fill: rgb("#1e293b"))[Умный кредитный кабинет предпринимателя]
  ],
  [
    #rect(
      fill: alfa-red,
      radius: 4pt,
      inset: (x: 8pt, y: 6pt),
      text(fill: white, weight: "bold", size: 8.5pt)[LIVE DEMO: andbel.ru]
    )
  ]
)

#v(2pt)
#line(length: 100%, stroke: 0.5pt + alfa-red)
#v(2pt)

// Key Links Bar
#grid(
  columns: (1.2fr, 1.3fr, 1fr),
  gutter: 8pt,
  rect(
    fill: light-gray, stroke: 0.5pt + border-gray, radius: 4pt, width: 100%, inset: 6pt,
    [
      #text(weight: "bold", size: 8pt, fill: rgb("#475569"))[🌐 Онлайн-стенд (Демо-сервер):] \
      #link("https://andbel.ru")[#text(weight: "bold", fill: alfa-red)[https://andbel.ru]]
    ]
  ),
  rect(
    fill: light-gray, stroke: 0.5pt + border-gray, radius: 4pt, width: 100%, inset: 6pt,
    [
      #text(weight: "bold", size: 8pt, fill: rgb("#475569"))[💻 Исходный код (GitHub):] \
      #link("https://github.com/AlphaHackaton/SmartCreditOffice/tree/main")[#text(weight: "bold", fill: rgb("#0366d6"))[AlphaHackaton/SmartCreditOffice]]
    ]
  ),
  rect(
    fill: light-gray, stroke: 0.5pt + border-gray, radius: 4pt, width: 100%, inset: 6pt,
    [
      #text(weight: "bold", size: 8pt, fill: rgb("#475569"))[🔑 Доступ жюри:] \
      #text(weight: "bold")[alfa-hack-2026] (права Read/Clone)
    ]
  )
)

#v(4pt)
#text(size: 10pt, weight: "bold", fill: rgb("#1e293b"))[1. Тестовые учётные записи (Пароль у всех: demo)]
#v(1pt)

#table(
  columns: (0.6fr, 1.3fr, 1.1fr, 1.2fr, 2.8fr),
  stroke: 0.4pt + border-gray,
  fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else if calc.even(row) { rgb("#f8fafc") } else { white },
  inset: 4pt,
  align: (center + horizon, left + horizon, center + horizon, center + horizon, left + horizon),
  [#text(weight: "bold")[Логин]],
  [#text(weight: "bold")[Компания / Бизнес]],
  [#text(weight: "bold")[Запрос]],
  [#text(weight: "bold")[Вердикт]],
  [#text(weight: "bold")[Сценарий и назначение профиля]],
  
  [`p1`], [ИП Соколова (Кофейни)], [2.0 млн / 24 мес], [#text(fill: rgb("#16a34a"), weight: "bold")[APPROVED]], [Грейд A (100 б.). Мгновенный скоринг, подписание кодом на экране, выдача.],
  [`p2`], [ООО «СеверСтрой»], [2.5 млн / 12 мес], [#text(fill: rgb("#d97706"), weight: "bold")[COUNTER_OFFER]], [Ограничение DSCR. Интерактивный симулятор: срок 30 мес или срез суммы.],
  [`p3`], [ООО «ТехноЛайн»], [4.0 млн / 36 мес], [#text(fill: rgb("#d97706"), weight: "bold")[COUNTER_OFFER]], [Макс. срок (36 мес): автоматический срез суммы под допустимый платеж.],
  [`p4`], [ИП Морозов (Розница)], [1.0 млн / 12 мес], [#text(fill: rgb("#dc2626"), weight: "bold")[REJECTED]], [Стоп-фактор БКИ (текущая просрочка 45 дн). Понятное дерево причин.],
  [`p5`], [ООО «Старт Плюс»], [1.0 млн / 12 мес], [#text(fill: rgb("#dc2626"), weight: "bold")[REJECTED]], [Стоп-фактор возраста бизнеса (2 мес). Точная дата повторной подачи.],
  [`p6`], [ООО «Агро-Юг»], [3.0 млн / 24 мес], [#text(fill: rgb("#2563eb"), weight: "bold")[UNDERWRITING]], [Флаг FNS_MISMATCH (расхождение оборотов). Направлена андеррайтеру.],
  [`underwriter`], [Сотрудник банка], [—], [#text(weight: "bold")[Банк / Аудит]], [Очередь ручной проверки, полное досье скоринга M1–M5, аппрув/отказ.]
)

#v(4pt)
#text(size: 10pt, weight: "bold", fill: rgb("#1e293b"))[2. Экспресс-сценарий проверки за 3 минуты]
#v(1pt)

#grid(
  columns: (1fr, 1fr),
  gutter: 8pt,
  rect(
    stroke: 0.4pt + border-gray, radius: 4pt, width: 100%, inset: 6pt, fill: white,
    [
      #text(weight: "bold", fill: alfa-red)[Шаг 1. Идеальный клиент (p1 / demo)] \
      #v(1pt)
      1. Вход под #text(weight: "bold")[`p1`] -> «Подать заявку» (2 млн / 24 мес). \
      2. Скоринг за 1.5 сек: результат #text(weight: "bold", fill: rgb("#16a34a"))[APPROVED] (Score 100). \
      3. Прозрачный разбор факторов (M1-M5: выручка, DSCR, БКИ). \
      4. «Подписать договор» -> ввод кода из UI -> статус #text(weight: "bold")[«Кредит выдан»].
    ]
  ),
  rect(
    stroke: 0.4pt + border-gray, radius: 4pt, width: 100%, inset: 6pt, fill: white,
    [
      #text(weight: "bold", fill: alfa-red)[Шаг 2. Контроффер и симулятор (p2 / demo)] \
      #v(1pt)
      1. Вход под #text(weight: "bold")[`p2`] -> запрос 2.5 млн на 12 мес. \
      2. Вердикт #text(weight: "bold", fill: rgb("#d97706"))[COUNTER_OFFER] (платёж превышает DSCR). \
      3. Два готовых оффера: удлинение до 30 мес или срез суммы. \
      4. #text(weight: "bold")[Интерактивный симулятор]: двигайте слайдеры срока и суммы — график платежей пересчитывается мгновенно!
    ]
  ),
  rect(
    stroke: 0.4pt + border-gray, radius: 4pt, width: 100%, inset: 6pt, fill: white,
    [
      #text(weight: "bold", fill: alfa-red)[Шаг 3. Стоп-факторы и Explainability (p4, p5)] \
      #v(1pt)
      1. Вход под #text(weight: "bold")[`p4`] (просрочка в БКИ) -> вердикт #text(weight: "bold", fill: rgb("#dc2626"))[REJECTED]. \
      2. Вход под #text(weight: "bold")[`p5`] (возраст компании 2 мес < 6 мес). \
      3. Система выводит не «сухой отказ», а #text(weight: "bold")[календарную дату], когда бизнес созреет для повторной подачи заявки.
    ]
  ),
  rect(
    stroke: 0.4pt + border-gray, radius: 4pt, width: 100%, inset: 6pt, fill: white,
    [
      #text(weight: "bold", fill: alfa-red)[Шаг 4. Контур андеррайтера (underwriter / demo)] \
      #v(1pt)
      1. Вход под #text(weight: "bold")[`underwriter`] -> открывается очередь заявок. \
      2. Заявка #text(weight: "bold")[`p6`] помечена флагом `FNS_MISMATCH`. \
      3. Досье: просмотр первичных выписок, БКИ и скоринговой трассы. \
      4. Решение: комментарий андеррайтера и подтверждение одобрения.
    ]
  )
)

#v(4pt)
#text(size: 10pt, weight: "bold", fill: rgb("#1e293b"))[3. Архитектура, соответствие регламенту (§2 SPEC) и запуск]
#v(1pt)

#rect(
  fill: light-gray, stroke: 0.4pt + border-gray, radius: 4pt, width: 100%, inset: 6pt,
  [
    #grid(
      columns: (1.5fr, 1fr),
      gutter: 10pt,
      [
        #text(weight: "bold")[Инженерные инварианты:] \
        • *100% соблюдение ограничений:* Десктопный Web (1280×900+), без платных API в рантайме, авторизация и подписание строго внутри UI, локальные моки ФНС/БКИ/выписок. \
        • *Стек:* Python 3.12, FastAPI, SQLAlchemy 2, PostgreSQL 16, React 18, TypeScript (strict), Alfa Core Components (`@alfalab/core-components`), Docker Compose. \
        • *Качество:* 807 unit/integration тестов backend + 332 теста frontend (*1 139 тестов, 100% PASS*).
      ],
      [
        #text(weight: "bold")[Локальный запуск (Docker CPU-only):] \
        ```bash
        git clone https://github.com/AlphaHackaton/SmartCreditOffice.git
        cd SmartCreditOffice
        docker compose up --build
        ```
        UI: #link("http://localhost:8080")[http://localhost:8080] | API: #link("http://localhost:8000/docs")[http://localhost:8000/docs] \
        Харнесс: `bash scripts/check.sh`
      ]
    )
  ]
)
