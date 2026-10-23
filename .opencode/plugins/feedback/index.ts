import { Plugin } from "@opencode/plugin"
import { spawnSync } from "node:child_process"
import path from "node:path"

/**
 * alpha.harness-feedback — петля обратной связи для вайбкодинга.
 *
 * 1) execute.after на edit/write/patch: запускает scripts/quick-check.sh
 *    по изменённому файлу и дописывает его stdout/stderr в результат вызова
 *    инструмента — агент видит ошибки линтера сразу после правки.
 * 2) Инструмент harness_check: полная проверка проекта (scripts/check.sh).
 *    Вызывать перед тем, как объявить задачу выполненной (правило в AGENTS.md).
 */

const EDIT_TOOLS = new Set(["edit", "write", "patch"])
const MAX_OUT = 4000
const QUICK_TIMEOUT_MS = 30_000
const FULL_TIMEOUT_MS = 600_000

function run(root: string, args: string[], timeout: number): { code: number; out: string } {
  const r = spawnSync("bash", args, { cwd: root, encoding: "utf8", timeout })
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim()
  return {
    code: r.status ?? 1,
    out: out.length > MAX_OUT ? "…" + out.slice(-MAX_OUT) : out,
  }
}

/** Дописать текст в result.content (строка или массив Content). */
function appendText(result: any, text: string): void {
  if (typeof result.content === "string") {
    result.content = result.content + text
    return
  }
  if (Array.isArray(result.content)) {
    result.content = [...result.content, { type: "text", text }]
    return
  }
  result.content = [{ type: "text", text }]
}

function extractPath(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined
  const raw = (input as Record<string, unknown>).path ?? (input as Record<string, unknown>).filePath
  return typeof raw === "string" ? raw : undefined
}

export default Plugin.define({
  id: "alpha.harness-feedback",
  async setup(ctx) {
    const root = ctx.location.directory

    // 1) Быстрая обратная связь после каждой правки файла
    await ctx.tool.hook("execute.after", (event) => {
      if (event.status !== "completed" || !EDIT_TOOLS.has(event.tool)) return
      const file = extractPath(event.input)
      if (!file) return
      const abs = path.isAbsolute(file) ? file : path.resolve(root, file)

      const { code, out } = run(root, ["scripts/quick-check.sh", abs], QUICK_TIMEOUT_MS)
      if (code === 0 && !out) return

      const label = `[harness quick-check] ${code === 0 ? "OK" : "FAIL"} (${path.relative(root, abs) || abs})`
      appendText(event.result, `\n\n${label}\n${out}`)
    })

    // 2) Полная проверка как инструмент
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "harness_check",
        description:
          "Run full project verification (scripts/check.sh): lint, types, tests, OpenAPI export, compose, deliverables. Call before declaring a task done; task is complete only when exit code is 0.",
        input: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => {
          const { code, out } = run(root, ["scripts/check.sh"], FULL_TIMEOUT_MS)
          return { content: `exit ${code}\n${out}` }
        },
      })
    })
  },
})
