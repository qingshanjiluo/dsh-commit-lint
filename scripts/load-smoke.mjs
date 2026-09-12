/**
 * Loads the built artifact and asserts it exports the Cordis function-plugin
 * face the harness loader requires. Run after `npm run build`.
 * @module
 */
import assert from 'node:assert/strict'

const mod = await import(new URL('../lib/index.js', import.meta.url).href)

assert.equal(mod.name, 'dsh-commit-lint', 'plugin name export')
assert.deepEqual(mod.inject, ['tools'], 'inject declares the tools service')
assert.equal(typeof mod.apply, 'function', 'apply is a function')
assert.ok(mod.Config, 'Config schema export present')

const registered = []
mod.apply({ tools: { register: def => registered.push(def) } }, { maxSubjectLength: 72 })
assert.deepEqual(registered.map(t => t.name).sort(), ['lint_commit', 'lint_staged'], 'both tools register')

console.log('load-smoke: ok —', registered.length, 'tools registered from built artifact')
