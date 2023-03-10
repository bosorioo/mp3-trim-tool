/* eslint-env node */
module.exports = {
  root: true,
  'extends': [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    'plugin:vue-pug/vue3-recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  ignorePatterns: [ 'dist/' ],
  globals: {
    'globalThis': 'readonly'
  },
  rules: {
    'no-unused-vars': [ 'error', { 'argsIgnorePattern': '^(_|reject$)' } ]
  }
}
