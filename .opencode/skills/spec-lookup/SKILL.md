---
name: spec-lookup
description: Use when a task needs a requirement, restriction or expert Q&A answer from SPEC_FOR_AGENT.md. Returns precise citations (§ and Q&A numbers) without loading the whole 45 KB document.
---

# Поиск в SPEC_FOR_AGENT.md

1. Не читай SPEC_FOR_AGENT.md целиком (247 строк, 45 КБ). Карта документа:
   - §2 — жёсткие запреты (красные флаги)
   - §3 — разрешённые упрощения (зелёный коридор)
   - §4 — сквозной бизнес-сценарий
   - §5 — база 75 Q&A экспертов (A: 1–52 вебинар, B: 53–75 чат)
   - §6 — финальный чек-лист сдачи
2. Сначала `grep -n -i "<ключевое слово>" SPEC_FOR_AGENT.md`, затем `read` с `offset`/`limit` ±10 строк вокруг совпадения.
3. Для широких вопросов («что говорят про скоринг?») делегируй субагенту explore:
   «Найди в SPEC_FOR_AGENT.md всё про <тема>, верни цитаты с номерами строк».
4. В ответе, proposal и задачах ссылайся на источник как «SPEC §5 Q12» или «SPEC §2 п.4».
5. Если в SPEC прямого ответа нет — зафиксируй это как допущение (assumption) в design.md изменения.
