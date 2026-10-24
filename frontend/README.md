# Frontend — кредитный кабинет

Нужен Node.js 22.12+ (проверено на 24.21). Из корня репозитория:

```bash
cd frontend
npm ci
npm run dev
```

Открыть http://localhost:5173. Backend, БД и LLM для каркаса не нужны.

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run preview
npm run notices
```

React 18 и официальные отдельные пакеты Alfa Core Components используются по решению команды: общий пакет 50.38.0 тянет устаревший react-virtual с peer React 16/17. Отдельные Typography/Button/Vars поддерживают React 18. Стили импортируются из поставляемых пакетов; сборка не загружает шрифты/CDN.

Это предварительный просмотр каркаса. Реального входа, RBAC, данных компаний и банковских операций пока нет. Токен будущей сессии хранится только в памяти; при смене сессии кеш отменяется и очищается. QueryClient создаётся один раз на приложение, автоматические retry отключены. Перезагрузка страницы сбрасывает сессию.

## Навигация

Адреса: `/client`, `/client/applications/new`, `/client/applications/:id`, `/bank/applications`, `/bank/applications/:id`, `/bank/metrics`, `/login`. Корень ведёт в клиентский кабинет; неизвестный адрес — на 404. Меню «Клиент / Банк» переключает только предварительный просмотр, а не права действующего пользователя.

Проверка в браузере: desktop iframe-viewport 1280×900 и 1440×900 — меню и контент не перекрываются; прямой адрес `/bank/applications/qa-case` сохраняется после refresh; Tab/Enter переводят из очереди в метрики. Автотесты дополнительно проверяют все маршруты, aria-current, landmarks, клавиатуру и отсутствие API-запросов. Production history fallback добавит Dev 2 при подключении nginx.
