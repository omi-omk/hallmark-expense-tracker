const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/.superpowers/', '<rootDir>/.worktrees/'],
  testPathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/.superpowers/', '<rootDir>/.worktrees/'],
  watchPathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/.superpowers/', '<rootDir>/.worktrees/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

module.exports = createJestConfig(config)
