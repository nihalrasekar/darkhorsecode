import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyTemplate, packageName } from './viteReactTemplate.mjs'

test('package names are npm-safe', () => {
  assert.equal(packageName('My App'), 'my-app')
  assert.equal(packageName('  Weird__Name!! '), 'weird-name')
  assert.equal(packageName('...'), 'app')
})

test('the template fills every placeholder', () => {
  const files = applyTemplate('My App')
  for (const [file, body] of Object.entries(files)) {
    assert.ok(!body.includes('__PROJECT_NAME__'), `${file} still has a placeholder`)
  }
})

test('package.json is valid and carries the slug, the UI carries the title', () => {
  const files = applyTemplate('My App')
  const pkg = JSON.parse(files['package.json'])
  assert.equal(pkg.name, 'my-app')
  assert.equal(pkg.scripts.dev, 'vite')
  assert.ok(pkg.dependencies.react)
  assert.ok(files['index.html'].includes('<title>My App</title>'))
  assert.ok(files['src/App.jsx'].includes('My App'))
})

test('the scaffold is a complete vite app', () => {
  const files = applyTemplate('demo')
  for (const file of ['package.json', 'vite.config.js', 'index.html', 'src/main.jsx', 'src/App.jsx', 'src/index.css']) {
    assert.ok(files[file], `missing ${file}`)
  }
})
