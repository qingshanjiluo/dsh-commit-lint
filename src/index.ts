import { execSync } from 'node:child_process';
import { z } from 'zod';

export const name = 'dsh-commit-lint';
export const inject = ['settings', 'tools', 'commands'];
const configSchema = z.object({ enabled: z.boolean().default(true), allowScopes: z.string().default('') });

function getLastCommitMessage(): string {
  try { return execSync('git log -1 --pretty=%s', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); } catch { return ''; }
}

function validateCommit(message: string): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pattern = /^(\w+)(\(.+\))?(!)?:\s+.+/;
  if (!pattern.test(message)) {
    errors.push('不符合 Conventional Commits 格式: <type>(<scope>): <description>');
  }
  const typeMatch = message.match(/^(\w+)/);
  if (typeMatch) {
    const validTypes = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
    if (!validTypes.includes(typeMatch[1])) {
      errors.push(`无效的类型 "${typeMatch[1]}"。有效类型: ${validTypes.join(', ')}`);
    }
  }
  if (message.length > 72) warnings.push('提交消息超过 72 字符');
  if (message.includes('  ')) warnings.push('包含连续空格');
  if (/\d{7,}/.test(message)) warnings.push('包含过长数字序列');
  return { valid: errors.length === 0, errors, warnings };
}

function validateStagedCommits(): { hash: string; message: string; valid: boolean; errors: string[] }[] {
  try {
    const output = execSync('git log --oneline -10', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return output.split('\n').map(line => {
      const [hash, ...rest] = line.split(' ');
      const message = rest.join(' ');
      const result = validateCommit(message);
      return { hash, message, ...result };
    });
  } catch { return []; }
}

export function apply(ctx: any, config: Config) {
  if (!config.enabled) return;
  ctx.effect(() => ctx.tools.register({
    name: 'lint_commit', description: '验证提交消息是否符合 Conventional Commits 规范。',
    parameters: { message: { type: 'string', description: '提交消息（不填则检查最近一次提交）' } },
    output: { schema: { type: 'json' }, render: (_a: unknown, v: unknown) => {
      const r = v as any;
      const icon = r.valid ? '✅' : '❌';
      const lines = [`${icon} 提交消息: \`${r.message}\``];
      if (r.errors.length) lines.push('错误:\n' + r.errors.map((e: string) => `- ❌ ${e}`).join('\n'));
      if (r.warnings.length) lines.push('警告:\n' + r.warnings.map((w: string) => `- ⚠️ ${w}`).join('\n'));
      return [{ type: 'text', text: lines.join('\n') }];
    }},
    async execute(args: { message?: string }) {
      const msg = args.message || getLastCommitMessage();
      if (!msg) throw new Error('没有找到提交消息');
      return { message: msg, ...validateCommit(msg) };
    },
  }), 'dsh-commit-lint: lint');
  ctx.effect(() => ctx.tools.register({
    name: 'lint_staged', description: '检查最近提交的消息格式。',
    output: { schema: { type: 'json' }, render: (_a: unknown, v: unknown) => {
      const r = v as any[];
      const valid = r.filter(c => c.valid).length;
      const failed = r.filter(c => !c.valid).length;
      const lines = [`## 提交检查 (${valid}/${r.length} 通过)`];
      for (const c of r) {
        const icon = c.valid ? '✅' : '❌';
        lines.push(`${icon} \`${c.hash}\` ${c.message}`);
        if (c.errors.length) lines.push(`   ${c.errors.join(', ')}`);
      }
      return [{ type: 'text', text: lines.join('\n') }];
    }},
    async execute() { return validateStagedCommits(); },
  }), 'dsh-commit-lint: staged');
  ctx.effect(() => ctx.commands.register({
    name: 'commit-lint', description: '提交消息检查', input: { hint: 'check | staged' },
    async handler() {
      const msg = getLastCommitMessage();
      if (!msg) return { kind: 'text', text: '没有提交' };
      const r = validateCommit(msg);
      return { kind: 'text', text: r.valid ? `✅ ${msg}` : `❌ ${r.errors.join(', ')}` };
    },
  }), 'dsh-commit-lint: command');
  ctx.inject(['settings'], (sctx: any) => { const { settingsNamespace } = require('@deepseek-ai/dsh-settings'); sctx.settings.register(settingsNamespace('commit-lint'), configSchema, { base: config, expose: true, applies: 'live' }); });
}
