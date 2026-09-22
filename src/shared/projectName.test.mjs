import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveProjectName } from './projectName.mjs'

test('strips the leading verb and article', () => {
  assert.equal(deriveProjectName('create a pomodoro app'), 'Pomodoro App')
  assert.equal(deriveProjectName('build me a todo list manager'), 'Todo List Manager')
  assert.equal(deriveProjectName('Can you make an expense tracker'), 'Expense Tracker')
})

test('only reads the first line, so an appended build-type hint is ignored', () => {
  const prompt = 'create a pomodoro app\n\nBuild it as a full-stack web app.'
  assert.equal(deriveProjectName(prompt), 'Pomodoro App')
})

test('caps at five words and falls back when nothing is left', () => {
  assert.equal(deriveProjectName('build a system to track expenses across multiple currencies'), 'System To Track Expenses Across')
  assert.equal(deriveProjectName(''), 'New App')
  assert.equal(deriveProjectName('create'), 'New App')
})
