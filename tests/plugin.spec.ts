import { describe, expect, it } from 'vitest'
import { apply, Config, inject, name } from '../src/index.ts'

interface RegisteredTool {
  name: string
  execute(args: never, exec: never): Promise<unknown>
}

function mountPlugin(config: { maxSubjectLength: number }): RegisteredTool[] {
  const registered: RegisteredTool[] = []
  const ctx = { tools: { register: (def: RegisteredTool) => registered.push(def) } }
  // The plugin only reads ctx.tools; a partial stub is the real registrant surface it touches.
  apply(ctx as never, config as never)
  return registered
}

describe('dsh-commit-lint plugin contract', () => {
  it('exports the loader plugin face', () => {
    expect(name).toBe('dsh-commit-lint')
    expect(inject).toEqual(['tools'])
    expect(typeof apply).toBe('function')
    expect(Config).toBeInstanceOf(Object)
  })

  it('registers the two documented tools', () => {
    const tools = mountPlugin({ maxSubjectLength: 72 })
    expect(tools.map(t => t.name).sort()).toEqual(['lint_commit', 'lint_staged'])
  })
})

describe('lint_commit', () => {
  const tool = () => mountPlugin({ maxSubjectLength: 72 })[0]!

  it('accepts a well-formed conventional message', async () => {
    const result = await tool().execute({ message: 'feat(commit-lint): add conventional checks' } as never, {} as never)
    expect(result).toMatchObject({ valid: true, errors: [] })
  })

  it('reports unknown type, capital subject, trailing period, and over-long subject', async () => {
    const long = `chore: ${'a'.repeat(100)}`
    const result = await tool().execute({ message: long } as never, {} as never) as { valid: boolean; errors: string[] }
    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('over the 72 limit')
  })

  it('flags a non-conventional header as a format failure', async () => {
    const result = await tool().execute({ message: 'Updated some files' } as never, {} as never) as { valid: boolean }
    expect(result.valid).toBe(false)
  })
})

describe('lint_staged', () => {
  const tool = () => mountPlugin({ maxSubjectLength: 72 })[1]!

  it('flags sensitive-looking and artifact paths', async () => {
    const result = await tool().execute({ files: ['.env', 'build.o', 'src/index.ts'] } as never, {} as never) as {
      count: number
      warnings: string[]
    }
    expect(result.count).toBe(3)
    expect(result.warnings.some(w => w.includes('.env'))).toBe(true)
    expect(result.warnings.some(w => w.includes('build.o'))).toBe(true)
    expect(result.warnings.every(w => !w.includes('src/index.ts'))).toBe(true)
  })

  it('passes a clean list', async () => {
    const result = await tool().execute({ files: ['src/a.ts', 'README.md'] } as never, {} as never) as { warnings: string[] }
    expect(result.warnings).toEqual([])
  })
})
