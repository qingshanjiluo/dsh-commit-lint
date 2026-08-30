# dsh-commit-lint

> DeepSeek Harness 提交消息检查

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ 功能特性

- ✅ **格式验证**: 检查是否符合 Conventional Commits 规范
- 📋 **批量检查**: 检查最近多次提交的消息格式
- 🔍 **详细反馈**: 提供具体的错误和警告信息

## 📦 安装

```bash
npm install dsh-commit-lint
```

## 🛠️ 工具

| 工具名 | 描述 | 参数 |
|--------|------|------|
| `lint_commit` | 验证提交消息 | `message` |
| `lint_staged` | 检查最近提交 | 无 |

## 📋 命令

- `/commit-lint check` — 检查最近提交
- `/commit-lint staged` — 检查所有

## 有效类型

`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`

## ⚙️ 配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | `true` | 启用插件 |

## 📄 License

MIT
