# Сторонние компоненты

Состояние: 25.10.2026. Runtime-зависимости в backend/pyproject.toml пока отсутствуют.

## Backend: инструменты разработки

Зависимости зафиксированы в `backend/uv.lock` и `backend/pyproject.toml`.
Все текущие пакеты являются инструментами разработки/тестирования (dev-only, в runtime поставку docker-образа не входят).

### Прямые зависимости (dev-only)

| Пакет | Версия | Лицензия | Ссылка / Репозиторий |
|---|---|---|---|
| `hypothesis` | 6.170.9 | MPL-2.0 | https://hypothesis.readthedocs.io/ |
| `mypy` | 2.4.0 | MIT | https://www.mypy-lang.org/ |
| `pytest` | 9.1.1 | MIT | https://docs.pytest.org/ |
| `ruff` | 0.17.2 | MIT | https://docs.astral.sh/ruff |

### Транзитивные зависимости (dev-only)

| Пакет | Версия | Лицензия | Ссылка / Репозиторий |
|---|---|---|---|
| `ast-serialize` | 0.13.1 | MIT | https://github.com/mypyc/ast_serialize |
| `colorama` | 0.4.6 | BSD-3-Clause | https://github.com/tartley/colorama |
| `iniconfig` | 2.3.1 | MIT | https://github.com/pytest-dev/iniconfig |
| `librt` | 0.16.0 | MIT | https://github.com/mypyc/librt |
| `mypy-extensions` | 1.1.0 | MIT | https://github.com/python/mypy_extensions |
| `packaging` | 26.3 | Apache-2.0 OR BSD-2-Clause | https://packaging.pypa.io/ |
| `pathspec` | 1.1.1 | MPL-2.0 | https://github.com/cpburnz/python-pathspec |
| `pluggy` | 1.7.0 | MIT | https://github.com/pytest-dev/pluggy |
| `pygments` | 2.21.0 | BSD-2-Clause | https://pygments.org/ |
| `sortedcontainers` | 2.4.0 | Apache-2.0 | http://www.grantjenks.com/docs/sortedcontainers/ |
| `typing-extensions` | 4.16.0 | PSF-2.0 | https://github.com/python/typing_extensions |


## Frontend

Генерация: `cd frontend && npm run notices`. Версии и лицензии из package-lock.json.
Runtime включается в браузерную сборку; dev-only — инструменты разработки.

| Пакет | Версия | Лицензия | Назначение |
|---|---|---|---|
| [@acemir/cssom](https://www.npmjs.com/package/@acemir/cssom) | 0.9.32 | MIT | транзитивная, dev-only |
| [@adobe/css-tools](https://www.npmjs.com/package/@adobe/css-tools) | 4.5.0 | MIT | транзитивная, dev-only |
| [@alfalab/core-components-button](https://www.npmjs.com/package/@alfalab/core-components-button) | 13.2.4 | MIT | прямая, runtime |
| [@alfalab/core-components-config](https://www.npmjs.com/package/@alfalab/core-components-config) | 1.1.0 | MIT | транзитивная, runtime |
| [@alfalab/core-components-form-control](https://www.npmjs.com/package/@alfalab/core-components-form-control) | 14.0.11 | MIT | транзитивная, runtime |
| [@alfalab/core-components-input](https://www.npmjs.com/package/@alfalab/core-components-input) | 17.2.2 | MIT | прямая, runtime |
| [@alfalab/core-components-mq](https://www.npmjs.com/package/@alfalab/core-components-mq) | 6.0.9 | MIT | транзитивная, runtime |
| [@alfalab/core-components-shared](https://www.npmjs.com/package/@alfalab/core-components-shared) | 2.3.0 | MIT | транзитивная, runtime |
| [@alfalab/core-components-skeleton](https://www.npmjs.com/package/@alfalab/core-components-skeleton) | 7.0.5 | MIT | транзитивная, runtime |
| [@alfalab/core-components-spinner](https://www.npmjs.com/package/@alfalab/core-components-spinner) | 6.0.9 | MIT | транзитивная, runtime |
| [@alfalab/core-components-status-badge](https://www.npmjs.com/package/@alfalab/core-components-status-badge) | 3.0.2 | MIT | транзитивная, runtime |
| [@alfalab/core-components-types](https://www.npmjs.com/package/@alfalab/core-components-types) | 2.1.0 | MIT | транзитивная, runtime |
| [@alfalab/core-components-typography](https://www.npmjs.com/package/@alfalab/core-components-typography) | 6.0.13 | MIT | прямая, runtime |
| [@alfalab/core-components-vars](https://www.npmjs.com/package/@alfalab/core-components-vars) | 11.4.1 | MIT | прямая, runtime |
| [@alfalab/data](https://www.npmjs.com/package/@alfalab/data) | 1.10.2 | MIT | транзитивная, runtime |
| [@alfalab/hooks](https://www.npmjs.com/package/@alfalab/hooks) | 1.18.1 | MIT | транзитивная, runtime |
| [@alfalab/icons-glyph](https://www.npmjs.com/package/@alfalab/icons-glyph) | 2.293.3 | MIT | транзитивная, runtime |
| [@alfalab/utils](https://www.npmjs.com/package/@alfalab/utils) | 1.22.0 | MIT | транзитивная, runtime |
| [@asamuzakjp/css-color](https://www.npmjs.com/package/@asamuzakjp/css-color) | 4.1.2 | MIT | транзитивная, dev-only |
| [@asamuzakjp/dom-selector](https://www.npmjs.com/package/@asamuzakjp/dom-selector) | 6.8.1 | MIT | транзитивная, dev-only |
| [@asamuzakjp/nwsapi](https://www.npmjs.com/package/@asamuzakjp/nwsapi) | 2.3.9 | MIT | транзитивная, dev-only |
| [@babel/code-frame](https://www.npmjs.com/package/@babel/code-frame) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/compat-data](https://www.npmjs.com/package/@babel/compat-data) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/core](https://www.npmjs.com/package/@babel/core) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/generator](https://www.npmjs.com/package/@babel/generator) | 7.29.8 | MIT | транзитивная, dev-only |
| [@babel/helper-compilation-targets](https://www.npmjs.com/package/@babel/helper-compilation-targets) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/helper-globals](https://www.npmjs.com/package/@babel/helper-globals) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/helper-module-imports](https://www.npmjs.com/package/@babel/helper-module-imports) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/helper-module-transforms](https://www.npmjs.com/package/@babel/helper-module-transforms) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/helper-plugin-utils](https://www.npmjs.com/package/@babel/helper-plugin-utils) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/helper-string-parser](https://www.npmjs.com/package/@babel/helper-string-parser) | 7.29.11 | MIT | транзитивная, dev-only |
| [@babel/helper-validator-identifier](https://www.npmjs.com/package/@babel/helper-validator-identifier) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/helper-validator-option](https://www.npmjs.com/package/@babel/helper-validator-option) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/helpers](https://www.npmjs.com/package/@babel/helpers) | 7.29.10 | MIT | транзитивная, dev-only |
| [@babel/parser](https://www.npmjs.com/package/@babel/parser) | 7.29.11 | MIT | транзитивная, dev-only |
| [@babel/plugin-transform-react-jsx-self](https://www.npmjs.com/package/@babel/plugin-transform-react-jsx-self) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/plugin-transform-react-jsx-source](https://www.npmjs.com/package/@babel/plugin-transform-react-jsx-source) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/runtime](https://www.npmjs.com/package/@babel/runtime) | 7.29.10 | MIT | транзитивная, dev-only |
| [@babel/template](https://www.npmjs.com/package/@babel/template) | 7.29.7 | MIT | транзитивная, dev-only |
| [@babel/traverse](https://www.npmjs.com/package/@babel/traverse) | 7.29.10 | MIT | транзитивная, dev-only |
| [@babel/types](https://www.npmjs.com/package/@babel/types) | 7.29.11 | MIT | транзитивная, dev-only |
| [@csstools/color-helpers](https://www.npmjs.com/package/@csstools/color-helpers) | 6.1.2 | MIT-0 | транзитивная, dev-only |
| [@csstools/css-calc](https://www.npmjs.com/package/@csstools/css-calc) | 3.4.3 | MIT | транзитивная, dev-only |
| [@csstools/css-color-parser](https://www.npmjs.com/package/@csstools/css-color-parser) | 4.2.6 | MIT | транзитивная, dev-only |
| [@csstools/css-parser-algorithms](https://www.npmjs.com/package/@csstools/css-parser-algorithms) | 4.0.2 | MIT | транзитивная, dev-only |
| [@csstools/css-syntax-patches-for-csstree](https://www.npmjs.com/package/@csstools/css-syntax-patches-for-csstree) | 1.1.15 | MIT-0 | транзитивная, dev-only |
| [@csstools/css-tokenizer](https://www.npmjs.com/package/@csstools/css-tokenizer) | 4.0.2 | MIT | транзитивная, dev-only |
| [@esbuild/aix-ppc64](https://www.npmjs.com/package/@esbuild/aix-ppc64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/android-arm](https://www.npmjs.com/package/@esbuild/android-arm) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/android-arm64](https://www.npmjs.com/package/@esbuild/android-arm64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/android-x64](https://www.npmjs.com/package/@esbuild/android-x64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/darwin-arm64](https://www.npmjs.com/package/@esbuild/darwin-arm64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/darwin-x64](https://www.npmjs.com/package/@esbuild/darwin-x64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/freebsd-arm64](https://www.npmjs.com/package/@esbuild/freebsd-arm64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/freebsd-x64](https://www.npmjs.com/package/@esbuild/freebsd-x64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/linux-arm](https://www.npmjs.com/package/@esbuild/linux-arm) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/linux-arm64](https://www.npmjs.com/package/@esbuild/linux-arm64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/linux-ia32](https://www.npmjs.com/package/@esbuild/linux-ia32) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/linux-loong64](https://www.npmjs.com/package/@esbuild/linux-loong64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/linux-mips64el](https://www.npmjs.com/package/@esbuild/linux-mips64el) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/linux-ppc64](https://www.npmjs.com/package/@esbuild/linux-ppc64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/linux-riscv64](https://www.npmjs.com/package/@esbuild/linux-riscv64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/linux-s390x](https://www.npmjs.com/package/@esbuild/linux-s390x) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/linux-x64](https://www.npmjs.com/package/@esbuild/linux-x64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/netbsd-arm64](https://www.npmjs.com/package/@esbuild/netbsd-arm64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/netbsd-x64](https://www.npmjs.com/package/@esbuild/netbsd-x64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/openbsd-arm64](https://www.npmjs.com/package/@esbuild/openbsd-arm64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/openbsd-x64](https://www.npmjs.com/package/@esbuild/openbsd-x64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/openharmony-arm64](https://www.npmjs.com/package/@esbuild/openharmony-arm64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/sunos-x64](https://www.npmjs.com/package/@esbuild/sunos-x64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/win32-arm64](https://www.npmjs.com/package/@esbuild/win32-arm64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/win32-ia32](https://www.npmjs.com/package/@esbuild/win32-ia32) | 0.28.2 | MIT | транзитивная, dev-only |
| [@esbuild/win32-x64](https://www.npmjs.com/package/@esbuild/win32-x64) | 0.28.2 | MIT | транзитивная, dev-only |
| [@eslint-community/eslint-utils](https://www.npmjs.com/package/@eslint-community/eslint-utils) | 4.10.1 | MIT | транзитивная, dev-only |
| [@eslint-community/regexpp](https://www.npmjs.com/package/@eslint-community/regexpp) | 4.12.2 | MIT | транзитивная, dev-only |
| [@eslint/config-array](https://www.npmjs.com/package/@eslint/config-array) | 0.21.2 | Apache-2.0 | транзитивная, dev-only |
| [@eslint/config-helpers](https://www.npmjs.com/package/@eslint/config-helpers) | 0.4.2 | Apache-2.0 | транзитивная, dev-only |
| [@eslint/core](https://www.npmjs.com/package/@eslint/core) | 0.17.0 | Apache-2.0 | транзитивная, dev-only |
| [@eslint/eslintrc](https://www.npmjs.com/package/@eslint/eslintrc) | 3.3.7 | MIT | транзитивная, dev-only |
| [@eslint/js](https://www.npmjs.com/package/@eslint/js) | 9.39.5 | MIT | прямая, dev-only |
| [@eslint/object-schema](https://www.npmjs.com/package/@eslint/object-schema) | 2.1.7 | Apache-2.0 | транзитивная, dev-only |
| [@eslint/plugin-kit](https://www.npmjs.com/package/@eslint/plugin-kit) | 0.4.1 | Apache-2.0 | транзитивная, dev-only |
| [@exodus/bytes](https://www.npmjs.com/package/@exodus/bytes) | 1.16.0 | MIT | транзитивная, dev-only |
| [@humanfs/core](https://www.npmjs.com/package/@humanfs/core) | 0.19.2 | Apache-2.0 | транзитивная, dev-only |
| [@humanfs/node](https://www.npmjs.com/package/@humanfs/node) | 0.16.8 | Apache-2.0 | транзитивная, dev-only |
| [@humanfs/types](https://www.npmjs.com/package/@humanfs/types) | 0.15.0 | Apache-2.0 | транзитивная, dev-only |
| [@humanwhocodes/module-importer](https://www.npmjs.com/package/@humanwhocodes/module-importer) | 1.0.1 | Apache-2.0 | транзитивная, dev-only |
| [@humanwhocodes/retry](https://www.npmjs.com/package/@humanwhocodes/retry) | 0.4.3 | Apache-2.0 | транзитивная, dev-only |
| [@jridgewell/gen-mapping](https://www.npmjs.com/package/@jridgewell/gen-mapping) | 0.3.13 | MIT | транзитивная, dev-only |
| [@jridgewell/remapping](https://www.npmjs.com/package/@jridgewell/remapping) | 2.3.5 | MIT | транзитивная, dev-only |
| [@jridgewell/resolve-uri](https://www.npmjs.com/package/@jridgewell/resolve-uri) | 3.1.2 | MIT | транзитивная, dev-only |
| [@jridgewell/sourcemap-codec](https://www.npmjs.com/package/@jridgewell/sourcemap-codec) | 1.6.0 | MIT | транзитивная, dev-only |
| [@jridgewell/trace-mapping](https://www.npmjs.com/package/@jridgewell/trace-mapping) | 0.3.31 | MIT | транзитивная, dev-only |
| [@maskito/core](https://www.npmjs.com/package/@maskito/core) | 1.9.0 | Apache-2.0 | транзитивная, runtime |
| [@napi-rs/lzma-linux-x64-gnu](https://www.npmjs.com/package/@napi-rs/lzma-linux-x64-gnu) | 1.5.1 | MIT | транзитивная, dev-only |
| [@redocly/ajv](https://www.npmjs.com/package/@redocly/ajv) | 8.11.2 | MIT | транзитивная, dev-only |
| [@redocly/config](https://www.npmjs.com/package/@redocly/config) | 0.22.0 | MIT | транзитивная, dev-only |
| [@redocly/openapi-core](https://www.npmjs.com/package/@redocly/openapi-core) | 1.34.22 | MIT | транзитивная, dev-only |
| [@rolldown/pluginutils](https://www.npmjs.com/package/@rolldown/pluginutils) | 1.0.0-rc.3 | MIT | транзитивная, dev-only |
| [@rollup/rollup-android-arm-eabi](https://www.npmjs.com/package/@rollup/rollup-android-arm-eabi) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-android-arm64](https://www.npmjs.com/package/@rollup/rollup-android-arm64) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-darwin-arm64](https://www.npmjs.com/package/@rollup/rollup-darwin-arm64) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-darwin-x64](https://www.npmjs.com/package/@rollup/rollup-darwin-x64) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-freebsd-arm64](https://www.npmjs.com/package/@rollup/rollup-freebsd-arm64) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-freebsd-x64](https://www.npmjs.com/package/@rollup/rollup-freebsd-x64) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-arm-gnueabihf](https://www.npmjs.com/package/@rollup/rollup-linux-arm-gnueabihf) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-arm-musleabihf](https://www.npmjs.com/package/@rollup/rollup-linux-arm-musleabihf) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-arm64-gnu](https://www.npmjs.com/package/@rollup/rollup-linux-arm64-gnu) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-arm64-musl](https://www.npmjs.com/package/@rollup/rollup-linux-arm64-musl) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-loong64-gnu](https://www.npmjs.com/package/@rollup/rollup-linux-loong64-gnu) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-loong64-musl](https://www.npmjs.com/package/@rollup/rollup-linux-loong64-musl) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-ppc64-gnu](https://www.npmjs.com/package/@rollup/rollup-linux-ppc64-gnu) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-ppc64-musl](https://www.npmjs.com/package/@rollup/rollup-linux-ppc64-musl) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-riscv64-gnu](https://www.npmjs.com/package/@rollup/rollup-linux-riscv64-gnu) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-riscv64-musl](https://www.npmjs.com/package/@rollup/rollup-linux-riscv64-musl) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-s390x-gnu](https://www.npmjs.com/package/@rollup/rollup-linux-s390x-gnu) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-x64-gnu](https://www.npmjs.com/package/@rollup/rollup-linux-x64-gnu) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-linux-x64-musl](https://www.npmjs.com/package/@rollup/rollup-linux-x64-musl) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-openbsd-x64](https://www.npmjs.com/package/@rollup/rollup-openbsd-x64) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-openharmony-arm64](https://www.npmjs.com/package/@rollup/rollup-openharmony-arm64) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-win32-arm64-msvc](https://www.npmjs.com/package/@rollup/rollup-win32-arm64-msvc) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-win32-ia32-msvc](https://www.npmjs.com/package/@rollup/rollup-win32-ia32-msvc) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-win32-x64-gnu](https://www.npmjs.com/package/@rollup/rollup-win32-x64-gnu) | 4.65.0 | MIT | транзитивная, dev-only |
| [@rollup/rollup-win32-x64-msvc](https://www.npmjs.com/package/@rollup/rollup-win32-x64-msvc) | 4.65.0 | MIT | транзитивная, dev-only |
| [@standard-schema/spec](https://www.npmjs.com/package/@standard-schema/spec) | 1.1.0 | MIT | транзитивная, dev-only |
| [@tanstack/query-core](https://www.npmjs.com/package/@tanstack/query-core) | 5.104.5 | MIT | транзитивная, runtime |
| [@tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query) | 5.104.5 | MIT | прямая, runtime |
| [@testing-library/dom](https://www.npmjs.com/package/@testing-library/dom) | 10.4.2 | MIT | транзитивная, dev-only |
| [@testing-library/jest-dom](https://www.npmjs.com/package/@testing-library/jest-dom) | 6.9.1 | MIT | прямая, dev-only |
| [@testing-library/react](https://www.npmjs.com/package/@testing-library/react) | 16.3.3 | MIT | прямая, dev-only |
| [@testing-library/user-event](https://www.npmjs.com/package/@testing-library/user-event) | 14.6.8 | MIT | прямая, dev-only |
| [@types/aria-query](https://www.npmjs.com/package/@types/aria-query) | 5.0.4 | MIT | транзитивная, dev-only |
| [@types/babel__core](https://www.npmjs.com/package/@types/babel__core) | 7.20.5 | MIT | транзитивная, dev-only |
| [@types/babel__generator](https://www.npmjs.com/package/@types/babel__generator) | 7.27.0 | MIT | транзитивная, dev-only |
| [@types/babel__template](https://www.npmjs.com/package/@types/babel__template) | 7.4.4 | MIT | транзитивная, dev-only |
| [@types/babel__traverse](https://www.npmjs.com/package/@types/babel__traverse) | 7.28.0 | MIT | транзитивная, dev-only |
| [@types/chai](https://www.npmjs.com/package/@types/chai) | 5.2.3 | MIT | транзитивная, dev-only |
| [@types/deep-eql](https://www.npmjs.com/package/@types/deep-eql) | 4.0.2 | MIT | транзитивная, dev-only |
| [@types/estree](https://www.npmjs.com/package/@types/estree) | 1.0.9 | MIT | транзитивная, dev-only |
| [@types/json-schema](https://www.npmjs.com/package/@types/json-schema) | 7.0.15 | MIT | транзитивная, dev-only |
| [@types/node](https://www.npmjs.com/package/@types/node) | 24.19.2 | MIT | прямая, dev-only |
| [@types/prop-types](https://www.npmjs.com/package/@types/prop-types) | 15.7.15 | MIT | транзитивная, runtime |
| [@types/react](https://www.npmjs.com/package/@types/react) | 18.3.31 | MIT | прямая, runtime |
| [@types/react-dom](https://www.npmjs.com/package/@types/react-dom) | 18.3.7 | MIT | прямая, dev-only |
| [@typescript-eslint/eslint-plugin](https://www.npmjs.com/package/@typescript-eslint/eslint-plugin) | 8.72.0 | MIT | транзитивная, dev-only |
| [@typescript-eslint/parser](https://www.npmjs.com/package/@typescript-eslint/parser) | 8.72.0 | MIT | транзитивная, dev-only |
| [@typescript-eslint/project-service](https://www.npmjs.com/package/@typescript-eslint/project-service) | 8.72.0 | MIT | транзитивная, dev-only |
| [@typescript-eslint/scope-manager](https://www.npmjs.com/package/@typescript-eslint/scope-manager) | 8.72.0 | MIT | транзитивная, dev-only |
| [@typescript-eslint/tsconfig-utils](https://www.npmjs.com/package/@typescript-eslint/tsconfig-utils) | 8.72.0 | MIT | транзитивная, dev-only |
| [@typescript-eslint/type-utils](https://www.npmjs.com/package/@typescript-eslint/type-utils) | 8.72.0 | MIT | транзитивная, dev-only |
| [@typescript-eslint/types](https://www.npmjs.com/package/@typescript-eslint/types) | 8.72.0 | MIT | транзитивная, dev-only |
| [@typescript-eslint/typescript-estree](https://www.npmjs.com/package/@typescript-eslint/typescript-estree) | 8.72.0 | MIT | транзитивная, dev-only |
| [@typescript-eslint/utils](https://www.npmjs.com/package/@typescript-eslint/utils) | 8.72.0 | MIT | транзитивная, dev-only |
| [@typescript-eslint/visitor-keys](https://www.npmjs.com/package/@typescript-eslint/visitor-keys) | 8.72.0 | MIT | транзитивная, dev-only |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) | 5.2.0 | MIT | прямая, dev-only |
| [@vitest/expect](https://www.npmjs.com/package/@vitest/expect) | 4.1.12 | MIT | транзитивная, dev-only |
| [@vitest/mocker](https://www.npmjs.com/package/@vitest/mocker) | 4.1.12 | MIT | транзитивная, dev-only |
| [@vitest/pretty-format](https://www.npmjs.com/package/@vitest/pretty-format) | 4.1.12 | MIT | транзитивная, dev-only |
| [@vitest/runner](https://www.npmjs.com/package/@vitest/runner) | 4.1.12 | MIT | транзитивная, dev-only |
| [@vitest/snapshot](https://www.npmjs.com/package/@vitest/snapshot) | 4.1.12 | MIT | транзитивная, dev-only |
| [@vitest/spy](https://www.npmjs.com/package/@vitest/spy) | 4.1.12 | MIT | транзитивная, dev-only |
| [@vitest/utils](https://www.npmjs.com/package/@vitest/utils) | 4.1.12 | MIT | транзитивная, dev-only |
| [acorn](https://www.npmjs.com/package/acorn) | 8.19.0 | MIT | транзитивная, dev-only |
| [acorn-jsx](https://www.npmjs.com/package/acorn-jsx) | 5.3.2 | MIT | транзитивная, dev-only |
| [agent-base](https://www.npmjs.com/package/agent-base) | 7.1.4 | MIT | транзитивная, dev-only |
| [ajv](https://www.npmjs.com/package/ajv) | 6.15.0 | MIT | транзитивная, dev-only |
| [ansi-colors](https://www.npmjs.com/package/ansi-colors) | 4.1.3 | MIT | транзитивная, dev-only |
| [ansi-regex](https://www.npmjs.com/package/ansi-regex) | 5.0.1 | MIT | транзитивная, dev-only |
| [ansi-styles](https://www.npmjs.com/package/ansi-styles) | 4.3.0 | MIT | транзитивная, dev-only |
| [ansi-styles](https://www.npmjs.com/package/ansi-styles) | 5.2.0 | MIT | транзитивная, dev-only |
| [argparse](https://www.npmjs.com/package/argparse) | 2.0.1 | Python-2.0 | транзитивная, dev-only |
| [aria-query](https://www.npmjs.com/package/aria-query) | 5.3.0 | Apache-2.0 | транзитивная, dev-only |
| [assertion-error](https://www.npmjs.com/package/assertion-error) | 2.0.1 | MIT | транзитивная, dev-only |
| [balanced-match](https://www.npmjs.com/package/balanced-match) | 4.0.4 | MIT | транзитивная, dev-only |
| [balanced-match](https://www.npmjs.com/package/balanced-match) | 1.0.2 | MIT | транзитивная, dev-only |
| [baseline-browser-mapping](https://www.npmjs.com/package/baseline-browser-mapping) | 2.11.32 | Apache-2.0 | транзитивная, dev-only |
| [bidi-js](https://www.npmjs.com/package/bidi-js) | 1.1.0 | MIT | транзитивная, dev-only |
| [brace-expansion](https://www.npmjs.com/package/brace-expansion) | 2.1.7 | MIT | транзитивная, dev-only |
| [brace-expansion](https://www.npmjs.com/package/brace-expansion) | 5.0.12 | MIT | транзитивная, dev-only |
| [brace-expansion](https://www.npmjs.com/package/brace-expansion) | 1.1.21 | MIT | транзитивная, dev-only |
| [browserslist](https://www.npmjs.com/package/browserslist) | 4.29.4 | MIT | транзитивная, dev-only |
| [callsites](https://www.npmjs.com/package/callsites) | 3.1.0 | MIT | транзитивная, dev-only |
| [caniuse-lite](https://www.npmjs.com/package/caniuse-lite) | 1.0.30001819 | CC-BY-4.0 | транзитивная, dev-only |
| [chai](https://www.npmjs.com/package/chai) | 6.3.0 | MIT | транзитивная, dev-only |
| [chalk](https://www.npmjs.com/package/chalk) | 4.1.2 | MIT | транзитивная, dev-only |
| [change-case](https://www.npmjs.com/package/change-case) | 5.4.4 | MIT | транзитивная, dev-only |
| [classnames](https://www.npmjs.com/package/classnames) | 2.5.1 | MIT | транзитивная, runtime |
| [color-convert](https://www.npmjs.com/package/color-convert) | 2.0.1 | MIT | транзитивная, dev-only |
| [color-name](https://www.npmjs.com/package/color-name) | 1.1.4 | MIT | транзитивная, dev-only |
| [colorette](https://www.npmjs.com/package/colorette) | 1.4.0 | MIT | транзитивная, dev-only |
| [concat-map](https://www.npmjs.com/package/concat-map) | 0.0.1 | MIT | транзитивная, dev-only |
| [convert-source-map](https://www.npmjs.com/package/convert-source-map) | 2.0.0 | MIT | транзитивная, dev-only |
| [cookie](https://www.npmjs.com/package/cookie) | 1.1.1 | MIT | транзитивная, runtime |
| [cross-spawn](https://www.npmjs.com/package/cross-spawn) | 7.0.6 | MIT | транзитивная, dev-only |
| [css-tree](https://www.npmjs.com/package/css-tree) | 3.2.1 | MIT | транзитивная, dev-only |
| [css.escape](https://www.npmjs.com/package/css.escape) | 1.5.1 | MIT | транзитивная, dev-only |
| [cssstyle](https://www.npmjs.com/package/cssstyle) | 5.3.7 | MIT | транзитивная, dev-only |
| [csstype](https://www.npmjs.com/package/csstype) | 3.2.3 | MIT | транзитивная, runtime |
| [data-urls](https://www.npmjs.com/package/data-urls) | 6.0.1 | MIT | транзитивная, dev-only |
| [debug](https://www.npmjs.com/package/debug) | 4.4.3 | MIT | транзитивная, dev-only |
| [decimal.js](https://www.npmjs.com/package/decimal.js) | 10.6.0 | MIT | транзитивная, dev-only |
| [deep-is](https://www.npmjs.com/package/deep-is) | 0.1.4 | MIT | транзитивная, dev-only |
| [dequal](https://www.npmjs.com/package/dequal) | 2.0.3 | MIT | транзитивная, dev-only |
| [detect-browser](https://www.npmjs.com/package/detect-browser) | 5.3.0 | MIT | транзитивная, runtime |
| [dom-accessibility-api](https://www.npmjs.com/package/dom-accessibility-api) | 0.6.3 | MIT | транзитивная, dev-only |
| [dom-accessibility-api](https://www.npmjs.com/package/dom-accessibility-api) | 0.5.16 | MIT | транзитивная, dev-only |
| [electron-to-chromium](https://www.npmjs.com/package/electron-to-chromium) | 1.5.464 | ISC | транзитивная, dev-only |
| [entities](https://www.npmjs.com/package/entities) | 8.1.0 | BSD-2-Clause | транзитивная, dev-only |
| [es-module-lexer](https://www.npmjs.com/package/es-module-lexer) | 2.3.2 | MIT | транзитивная, dev-only |
| [esbuild](https://www.npmjs.com/package/esbuild) | 0.28.2 | MIT | транзитивная, dev-only |
| [escalade](https://www.npmjs.com/package/escalade) | 3.2.0 | MIT | транзитивная, dev-only |
| [escape-string-regexp](https://www.npmjs.com/package/escape-string-regexp) | 4.0.0 | MIT | транзитивная, dev-only |
| [eslint](https://www.npmjs.com/package/eslint) | 9.39.5 | MIT | прямая, dev-only |
| [eslint-plugin-react-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks) | 5.2.0 | MIT | прямая, dev-only |
| [eslint-scope](https://www.npmjs.com/package/eslint-scope) | 8.4.0 | BSD-2-Clause | транзитивная, dev-only |
| [eslint-visitor-keys](https://www.npmjs.com/package/eslint-visitor-keys) | 3.4.3 | Apache-2.0 | транзитивная, dev-only |
| [eslint-visitor-keys](https://www.npmjs.com/package/eslint-visitor-keys) | 5.0.1 | Apache-2.0 | транзитивная, dev-only |
| [eslint-visitor-keys](https://www.npmjs.com/package/eslint-visitor-keys) | 4.2.1 | Apache-2.0 | транзитивная, dev-only |
| [espree](https://www.npmjs.com/package/espree) | 10.4.0 | BSD-2-Clause | транзитивная, dev-only |
| [esquery](https://www.npmjs.com/package/esquery) | 1.7.0 | BSD-3-Clause | транзитивная, dev-only |
| [esrecurse](https://www.npmjs.com/package/esrecurse) | 4.3.0 | BSD-2-Clause | транзитивная, dev-only |
| [estraverse](https://www.npmjs.com/package/estraverse) | 5.3.0 | BSD-2-Clause | транзитивная, dev-only |
| [estree-walker](https://www.npmjs.com/package/estree-walker) | 3.0.3 | MIT | транзитивная, dev-only |
| [esutils](https://www.npmjs.com/package/esutils) | 2.0.3 | BSD-2-Clause | транзитивная, dev-only |
| [expect-type](https://www.npmjs.com/package/expect-type) | 1.4.0 | Apache-2.0 | транзитивная, dev-only |
| [fast-deep-equal](https://www.npmjs.com/package/fast-deep-equal) | 3.1.3 | MIT | транзитивная, dev-only |
| [fast-json-stable-stringify](https://www.npmjs.com/package/fast-json-stable-stringify) | 2.1.0 | MIT | транзитивная, dev-only |
| [fast-levenshtein](https://www.npmjs.com/package/fast-levenshtein) | 2.0.6 | MIT | транзитивная, dev-only |
| [fdir](https://www.npmjs.com/package/fdir) | 6.5.0 | MIT | транзитивная, dev-only |
| [file-entry-cache](https://www.npmjs.com/package/file-entry-cache) | 8.0.0 | MIT | транзитивная, dev-only |
| [find-up](https://www.npmjs.com/package/find-up) | 5.0.0 | MIT | транзитивная, dev-only |
| [flat-cache](https://www.npmjs.com/package/flat-cache) | 4.0.1 | MIT | транзитивная, dev-only |
| [flatted](https://www.npmjs.com/package/flatted) | 3.4.4 | ISC | транзитивная, dev-only |
| [fsevents](https://www.npmjs.com/package/fsevents) | 2.3.3 | MIT | транзитивная, dev-only |
| [gensync](https://www.npmjs.com/package/gensync) | 1.0.0-beta.2 | MIT | транзитивная, dev-only |
| [glob-parent](https://www.npmjs.com/package/glob-parent) | 6.0.2 | ISC | транзитивная, dev-only |
| [globals](https://www.npmjs.com/package/globals) | 14.0.0 | MIT | прямая, dev-only |
| [globals](https://www.npmjs.com/package/globals) | 16.5.0 | MIT | прямая, dev-only |
| [has-flag](https://www.npmjs.com/package/has-flag) | 4.0.0 | MIT | транзитивная, dev-only |
| [html-encoding-sniffer](https://www.npmjs.com/package/html-encoding-sniffer) | 6.0.0 | MIT | транзитивная, dev-only |
| [http-proxy-agent](https://www.npmjs.com/package/http-proxy-agent) | 7.0.2 | MIT | транзитивная, dev-only |
| [https-proxy-agent](https://www.npmjs.com/package/https-proxy-agent) | 7.0.6 | MIT | транзитивная, dev-only |
| [ignore](https://www.npmjs.com/package/ignore) | 7.0.14 | MIT | транзитивная, dev-only |
| [ignore](https://www.npmjs.com/package/ignore) | 5.3.2 | MIT | транзитивная, dev-only |
| [import-fresh](https://www.npmjs.com/package/import-fresh) | 3.3.1 | MIT | транзитивная, dev-only |
| [imurmurhash](https://www.npmjs.com/package/imurmurhash) | 0.1.4 | MIT | транзитивная, dev-only |
| [indent-string](https://www.npmjs.com/package/indent-string) | 4.0.0 | MIT | транзитивная, dev-only |
| [index-to-position](https://www.npmjs.com/package/index-to-position) | 1.2.0 | MIT | транзитивная, dev-only |
| [is-extglob](https://www.npmjs.com/package/is-extglob) | 2.1.1 | MIT | транзитивная, dev-only |
| [is-glob](https://www.npmjs.com/package/is-glob) | 4.0.3 | MIT | транзитивная, dev-only |
| [is-potential-custom-element-name](https://www.npmjs.com/package/is-potential-custom-element-name) | 1.0.1 | MIT | транзитивная, dev-only |
| [isexe](https://www.npmjs.com/package/isexe) | 2.0.0 | ISC | транзитивная, dev-only |
| [js-levenshtein](https://www.npmjs.com/package/js-levenshtein) | 1.1.6 | MIT | транзитивная, dev-only |
| [js-tokens](https://www.npmjs.com/package/js-tokens) | 4.0.0 | MIT | транзитивная, runtime |
| [js-yaml](https://www.npmjs.com/package/js-yaml) | 4.3.2 | MIT | транзитивная, dev-only |
| [jsdom](https://www.npmjs.com/package/jsdom) | 27.4.0 | MIT | прямая, dev-only |
| [jsesc](https://www.npmjs.com/package/jsesc) | 3.1.0 | MIT | транзитивная, dev-only |
| [json-buffer](https://www.npmjs.com/package/json-buffer) | 3.0.1 | MIT | транзитивная, dev-only |
| [json-schema-traverse](https://www.npmjs.com/package/json-schema-traverse) | 1.0.0 | MIT | транзитивная, dev-only |
| [json-schema-traverse](https://www.npmjs.com/package/json-schema-traverse) | 0.4.1 | MIT | транзитивная, dev-only |
| [json-stable-stringify-without-jsonify](https://www.npmjs.com/package/json-stable-stringify-without-jsonify) | 1.0.1 | MIT | транзитивная, dev-only |
| [json5](https://www.npmjs.com/package/json5) | 2.2.3 | MIT | транзитивная, dev-only |
| [keyv](https://www.npmjs.com/package/keyv) | 4.5.4 | MIT | транзитивная, dev-only |
| [levn](https://www.npmjs.com/package/levn) | 0.4.1 | MIT | транзитивная, dev-only |
| [locate-path](https://www.npmjs.com/package/locate-path) | 6.0.0 | MIT | транзитивная, dev-only |
| [lodash](https://www.npmjs.com/package/lodash) | 4.18.1 | MIT | транзитивная, runtime |
| [lodash.merge](https://www.npmjs.com/package/lodash.merge) | 4.6.2 | MIT | транзитивная, dev-only |
| [loose-envify](https://www.npmjs.com/package/loose-envify) | 1.4.0 | MIT | транзитивная, runtime |
| [lru-cache](https://www.npmjs.com/package/lru-cache) | 11.5.3 | BlueOak-1.0.0 | транзитивная, dev-only |
| [lru-cache](https://www.npmjs.com/package/lru-cache) | 11.5.3 | BlueOak-1.0.0 | транзитивная, dev-only |
| [lru-cache](https://www.npmjs.com/package/lru-cache) | 11.5.3 | BlueOak-1.0.0 | транзитивная, dev-only |
| [lru-cache](https://www.npmjs.com/package/lru-cache) | 5.1.1 | ISC | транзитивная, dev-only |
| [lz-string](https://www.npmjs.com/package/lz-string) | 1.5.0 | MIT | транзитивная, dev-only |
| [magic-string](https://www.npmjs.com/package/magic-string) | 0.30.21 | MIT | транзитивная, dev-only |
| [mdn-data](https://www.npmjs.com/package/mdn-data) | 2.27.1 | CC0-1.0 | транзитивная, dev-only |
| [min-indent](https://www.npmjs.com/package/min-indent) | 1.0.1 | MIT | транзитивная, dev-only |
| [minimatch](https://www.npmjs.com/package/minimatch) | 5.1.9 | ISC | транзитивная, dev-only |
| [minimatch](https://www.npmjs.com/package/minimatch) | 10.2.6 | BlueOak-1.0.0 | транзитивная, dev-only |
| [minimatch](https://www.npmjs.com/package/minimatch) | 3.1.5 | ISC | транзитивная, dev-only |
| [ms](https://www.npmjs.com/package/ms) | 2.1.3 | MIT | транзитивная, dev-only |
| [nanoid](https://www.npmjs.com/package/nanoid) | 3.3.20 | MIT | транзитивная, dev-only |
| [natural-compare](https://www.npmjs.com/package/natural-compare) | 1.4.0 | MIT | транзитивная, dev-only |
| [node-releases](https://www.npmjs.com/package/node-releases) | 2.0.60 | MIT | транзитивная, dev-only |
| [obug](https://www.npmjs.com/package/obug) | 2.2.1 | MIT | транзитивная, dev-only |
| [openapi-typescript](https://www.npmjs.com/package/openapi-typescript) | 7.13.0 | MIT | прямая, dev-only |
| [optionator](https://www.npmjs.com/package/optionator) | 0.9.4 | MIT | транзитивная, dev-only |
| [p-limit](https://www.npmjs.com/package/p-limit) | 3.1.0 | MIT | транзитивная, dev-only |
| [p-locate](https://www.npmjs.com/package/p-locate) | 5.0.0 | MIT | транзитивная, dev-only |
| [parent-module](https://www.npmjs.com/package/parent-module) | 1.0.1 | MIT | транзитивная, dev-only |
| [parse-json](https://www.npmjs.com/package/parse-json) | 8.3.0 | MIT | транзитивная, dev-only |
| [parse5](https://www.npmjs.com/package/parse5) | 8.0.1 | MIT | транзитивная, dev-only |
| [path-exists](https://www.npmjs.com/package/path-exists) | 4.0.0 | MIT | транзитивная, dev-only |
| [path-key](https://www.npmjs.com/package/path-key) | 3.1.1 | MIT | транзитивная, dev-only |
| [pathe](https://www.npmjs.com/package/pathe) | 2.0.3 | MIT | транзитивная, dev-only |
| [picocolors](https://www.npmjs.com/package/picocolors) | 1.1.1 | ISC | транзитивная, dev-only |
| [picomatch](https://www.npmjs.com/package/picomatch) | 4.0.7 | MIT | транзитивная, dev-only |
| [pluralize](https://www.npmjs.com/package/pluralize) | 8.0.0 | MIT | транзитивная, dev-only |
| [postcss](https://www.npmjs.com/package/postcss) | 8.5.31 | MIT | транзитивная, dev-only |
| [prelude-ls](https://www.npmjs.com/package/prelude-ls) | 1.2.1 | MIT | транзитивная, dev-only |
| [pretty-format](https://www.npmjs.com/package/pretty-format) | 27.5.1 | MIT | транзитивная, dev-only |
| [punycode](https://www.npmjs.com/package/punycode) | 2.3.1 | MIT | транзитивная, dev-only |
| [react](https://www.npmjs.com/package/react) | 18.3.1 | MIT | прямая, runtime |
| [react-dom](https://www.npmjs.com/package/react-dom) | 18.3.1 | MIT | прямая, runtime |
| [react-is](https://www.npmjs.com/package/react-is) | 17.0.2 | MIT | транзитивная, dev-only |
| [react-merge-refs](https://www.npmjs.com/package/react-merge-refs) | 1.1.0 | MIT | транзитивная, runtime |
| [react-refresh](https://www.npmjs.com/package/react-refresh) | 0.18.0 | MIT | транзитивная, dev-only |
| [react-router](https://www.npmjs.com/package/react-router) | 7.18.4 | MIT | транзитивная, runtime |
| [react-router-dom](https://www.npmjs.com/package/react-router-dom) | 7.18.4 | MIT | прямая, runtime |
| [redent](https://www.npmjs.com/package/redent) | 3.0.0 | MIT | транзитивная, dev-only |
| [require-from-string](https://www.npmjs.com/package/require-from-string) | 2.0.2 | MIT | транзитивная, dev-only |
| [resolve-from](https://www.npmjs.com/package/resolve-from) | 4.0.0 | MIT | транзитивная, dev-only |
| [rollup](https://www.npmjs.com/package/rollup) | 4.65.0 | MIT | транзитивная, dev-only |
| [saxes](https://www.npmjs.com/package/saxes) | 6.0.0 | ISC | транзитивная, dev-only |
| [scheduler](https://www.npmjs.com/package/scheduler) | 0.23.2 | MIT | транзитивная, runtime |
| [semver](https://www.npmjs.com/package/semver) | 7.8.5 | ISC | транзитивная, dev-only |
| [semver](https://www.npmjs.com/package/semver) | 6.3.1 | ISC | транзитивная, dev-only |
| [set-cookie-parser](https://www.npmjs.com/package/set-cookie-parser) | 2.7.3 | MIT | транзитивная, runtime |
| [shebang-command](https://www.npmjs.com/package/shebang-command) | 2.0.0 | MIT | транзитивная, dev-only |
| [shebang-regex](https://www.npmjs.com/package/shebang-regex) | 3.0.0 | MIT | транзитивная, dev-only |
| [siginfo](https://www.npmjs.com/package/siginfo) | 2.0.0 | ISC | транзитивная, dev-only |
| [source-map-js](https://www.npmjs.com/package/source-map-js) | 1.2.2 | BSD-3-Clause | транзитивная, dev-only |
| [stackback](https://www.npmjs.com/package/stackback) | 0.0.2 | MIT | транзитивная, dev-only |
| [std-env](https://www.npmjs.com/package/std-env) | 4.3.0 | MIT | транзитивная, dev-only |
| [strip-indent](https://www.npmjs.com/package/strip-indent) | 3.0.0 | MIT | транзитивная, dev-only |
| [strip-json-comments](https://www.npmjs.com/package/strip-json-comments) | 3.1.1 | MIT | транзитивная, dev-only |
| [supports-color](https://www.npmjs.com/package/supports-color) | 10.2.2 | MIT | транзитивная, dev-only |
| [supports-color](https://www.npmjs.com/package/supports-color) | 7.2.0 | MIT | транзитивная, dev-only |
| [symbol-tree](https://www.npmjs.com/package/symbol-tree) | 3.2.4 | MIT | транзитивная, dev-only |
| [tinybench](https://www.npmjs.com/package/tinybench) | 2.9.0 | MIT | транзитивная, dev-only |
| [tinyexec](https://www.npmjs.com/package/tinyexec) | 1.3.1 | MIT | транзитивная, dev-only |
| [tinyglobby](https://www.npmjs.com/package/tinyglobby) | 0.2.17 | MIT | транзитивная, dev-only |
| [tinyrainbow](https://www.npmjs.com/package/tinyrainbow) | 3.2.0 | MIT | транзитивная, dev-only |
| [tldts](https://www.npmjs.com/package/tldts) | 7.4.19 | MIT | транзитивная, dev-only |
| [tldts-core](https://www.npmjs.com/package/tldts-core) | 7.4.19 | MIT | транзитивная, dev-only |
| [tough-cookie](https://www.npmjs.com/package/tough-cookie) | 6.0.2 | BSD-3-Clause | транзитивная, dev-only |
| [tr46](https://www.npmjs.com/package/tr46) | 6.0.0 | MIT | транзитивная, dev-only |
| [ts-api-utils](https://www.npmjs.com/package/ts-api-utils) | 2.5.0 | MIT | транзитивная, dev-only |
| [tslib](https://www.npmjs.com/package/tslib) | 2.8.1 | 0BSD | транзитивная, runtime |
| [type-check](https://www.npmjs.com/package/type-check) | 0.4.0 | MIT | транзитивная, dev-only |
| [type-fest](https://www.npmjs.com/package/type-fest) | 4.41.0 | (MIT OR CC0-1.0) | транзитивная, dev-only |
| [typescript](https://www.npmjs.com/package/typescript) | 5.9.3 | Apache-2.0 | прямая, dev-only |
| [typescript-eslint](https://www.npmjs.com/package/typescript-eslint) | 8.72.0 | MIT | прямая, dev-only |
| [undici-types](https://www.npmjs.com/package/undici-types) | 7.24.6 | MIT | транзитивная, dev-only |
| [update-browserslist-db](https://www.npmjs.com/package/update-browserslist-db) | 1.3.4 | MIT | транзитивная, dev-only |
| [uri-js](https://www.npmjs.com/package/uri-js) | 4.4.1 | BSD-2-Clause | транзитивная, dev-only |
| [uri-js-replace](https://www.npmjs.com/package/uri-js-replace) | 1.0.2 | MIT | транзитивная, dev-only |
| [uuid](https://www.npmjs.com/package/uuid) | 14.0.3 | MIT | транзитивная, runtime |
| [vite](https://www.npmjs.com/package/vite) | 7.3.7 | MIT | прямая, dev-only |
| [vitest](https://www.npmjs.com/package/vitest) | 4.1.12 | MIT | прямая, dev-only |
| [w3c-xmlserializer](https://www.npmjs.com/package/w3c-xmlserializer) | 5.0.0 | MIT | транзитивная, dev-only |
| [webidl-conversions](https://www.npmjs.com/package/webidl-conversions) | 8.0.1 | BSD-2-Clause | транзитивная, dev-only |
| [whatwg-mimetype](https://www.npmjs.com/package/whatwg-mimetype) | 5.0.0 | MIT | транзитивная, dev-only |
| [whatwg-mimetype](https://www.npmjs.com/package/whatwg-mimetype) | 4.0.0 | MIT | транзитивная, dev-only |
| [whatwg-url](https://www.npmjs.com/package/whatwg-url) | 15.1.0 | MIT | транзитивная, dev-only |
| [which](https://www.npmjs.com/package/which) | 2.0.2 | ISC | транзитивная, dev-only |
| [why-is-node-running](https://www.npmjs.com/package/why-is-node-running) | 2.3.0 | MIT | транзитивная, dev-only |
| [word-wrap](https://www.npmjs.com/package/word-wrap) | 1.2.5 | MIT | транзитивная, dev-only |
| [ws](https://www.npmjs.com/package/ws) | 8.22.0 | MIT | транзитивная, dev-only |
| [xml-name-validator](https://www.npmjs.com/package/xml-name-validator) | 5.0.0 | Apache-2.0 | транзитивная, dev-only |
| [xmlchars](https://www.npmjs.com/package/xmlchars) | 2.2.0 | MIT | транзитивная, dev-only |
| [yallist](https://www.npmjs.com/package/yallist) | 3.1.1 | ISC | транзитивная, dev-only |
| [yaml-ast-parser](https://www.npmjs.com/package/yaml-ast-parser) | 0.0.43 | Apache-2.0 | транзитивная, dev-only |
| [yargs-parser](https://www.npmjs.com/package/yargs-parser) | 21.1.1 | ISC | транзитивная, dev-only |
| [yocto-queue](https://www.npmjs.com/package/yocto-queue) | 0.1.0 | MIT | транзитивная, dev-only |

## Локальные инструменты

OpenSpec 1.15.0 — MIT (https://github.com/Fission-AI/OpenSpec).
uv 0.13.5 — MIT / Apache-2.0 (https://github.com/astral-sh/uv).
Установлены для разработки, в приложение не включаются.

## Модели и моки

Веса моделей не установлены. Персоны backend/app/seed/personas.json — синтетические данные.
Интеграции ФНС, БКИ и выручки при реализации должны быть локальными моками: synthetic data, no real integration.
