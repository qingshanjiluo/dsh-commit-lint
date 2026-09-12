/**
 * Conventional-commit linter for DeepSeek Harness. `lint_commit` validates one
 * commit message against the Conventional Commits grammar and a configurable
 * subject budget; `lint_staged` reviews a caller-supplied list of staged paths
 * for sizes and sensitive-looking names that usually deserve a second look.
 * Both tools are pure — they shell out to nothing — so the plugin carries no
 * host process or filesystem dependency.
 * @module @deepseek-ai/dsh-commit-lint
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-commit-lint'
export const inject = ['tools']

/** Deployment policy for the commit linter. */
export interface Config {
  /**
   * Maximum subject-line length counted from the start of the message to the
   * first newline. Bodies are not length-checked.
   */
  maxSubjectLength: number
}

/** Schemastery configuration for the commit linter. */
export const Config: z<Config> = z.object({
  maxSubjectLength: z.number().default(72),
})

const TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor', 'perf',
  'test', 'build', 'ci', 'chore', 'revert',
] as const

const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^()]*)\))?(?<breaking>!)?: (?<subject>.+)$/

/**
 * Lint one commit message against Conventional Commits.
 * @param message - the raw commit message.
 * @param maxSubjectLength - subject budget from {@link Config}.
 * @returns validity plus every violation found, in check order.
 */
function lintMessage(message: string, maxSubjectLength: number): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const trimmed = message.replace(/\s+$/, '')
  if (trimmed.length === 0) {
    errors.push('message is empty')
    return { valid: false, errors }
  }
  const subjectLine = trimmed.split(/\r?\n/, 1)[0]
  const header = HEADER.exec(subjectLine)
  if (!header) {
    errors.push('subject must match `<type>[optional scope][!]: <summary>`')
  } else {
    const { type, scope, subject } = header.groups as { type: string; scope?: string; subject: string }
    if (!TYPES.includes(type as (typeof TYPES)[number])) {
      errors.push(`unknown type "${type}"; expected one of ${TYPES.join(', ')}`)
    }
    if (scope !== undefined && scope.trim().length === 0) errors.push('scope must be non-empty when present')
    if (!/^[a-z]/.test(subject)) errors.push('subject must start with a lowercase letter')
    if (subject.length > maxSubjectLength) {
      errors.push(`subject is ${subject.length} chars, over the ${maxSubjectLength} limit`)
    }
  }
  if (subjectLine.endsWith('.')) errors.push('subject must not end with a period')
  return { valid: errors.length === 0, errors }
}

const SECRET_NAME = /(^|[._-])(\.?env|secret|credential|token|password|private[-_.]?key|id[-_.]?rsa|\.npmrc|\.netrc)([._-]|$)/i
const BUILD_ARTIFACT = /\.(o|a|so|dll|dylib|class|jar|war|pyc|bundle|min\.js|map)$/i

/**
 * Flag risky staged paths supplied by the caller (typically `git diff --cached
 * --name-only`). No git subprocess is run; the model provides the list.
 * @param files - staged paths.
 * @returns count and per-path warnings.
 */
function reviewStaged(files: readonly string[]): { count: number; warnings: string[] } {
  const warnings: string[] = []
  for (const file of files) {
    if (SECRET_NAME.test(file)) warnings.push(`${file}: looks sensitive — confirm it is not a real secret before committing`)
    if (BUILD_ARTIFACT.test(file)) warnings.push(`${file}: build artifact is usually not tracked`)
    if (file.length > 200) warnings.push(`${file}: unusually long path`)
  }
  if (files.length > 300) warnings.push(`${files.length} staged files — consider splitting the commit`)
  return { count: files.length, warnings }
}

/**
 * Register the commit-lint tools on `ctx.tools`.
 * @param ctx - registrant context carrying the tool registry.
 * @param config - deployment's explicit linter policy.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.tools.register(defineTool({
    name: 'lint_commit',
    description:
      'Check one commit message against the Conventional Commits grammar and the ' +
      'configured subject length. Pass the full message; it reports every violation.',
    parameters: {
      message: { type: 'string', required: true, description: 'The complete commit message (subject line and body).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          valid: { type: 'boolean', required: true, description: 'Whether the message passes every check.' },
          errors: {
            type: 'array',
            required: true,
            description: 'Violations in check order; empty when valid.',
            items: { type: 'string' },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.valid
          ? 'Commit message is valid.'
          : `Commit message has ${value.errors.length} issue(s):\n- ${value.errors.join('\n- ')}`,
      }],
    },
    isConcurrencySafe: () => true,
    execute(args) {
      return Promise.resolve(lintMessage(args.message, config.maxSubjectLength))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'lint_staged',
    description:
      'Review a list of staged file paths for sensitive-looking names, build ' +
      'artifacts, and over-large commits. Supply the paths yourself (for example ' +
      'from `git diff --cached --name-only`); the tool runs no git command.',
    parameters: {
      files: {
        type: 'array',
        required: true,
        description: 'Staged file paths to review.',
        items: { type: 'string' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          count: { type: 'integer', required: true, description: 'Number of paths reviewed.' },
          warnings: {
            type: 'array',
            required: true,
            description: 'Per-path advisories; empty when nothing is flagged.',
            items: { type: 'string' },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.warnings.length === 0
          ? `${value.count} staged file(s), nothing flagged.`
          : `${value.count} staged file(s):\n- ${value.warnings.join('\n- ')}`,
      }],
    },
    isConcurrencySafe: () => true,
    execute(args) {
      return Promise.resolve(reviewStaged(args.files))
    },
  }))
}
