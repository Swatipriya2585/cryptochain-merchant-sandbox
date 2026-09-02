'use strict';

const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(js|sql|example|md|json)$/.test(entry.name) || entry.name === '.env.sandbox.example') {
      files.push(full);
    }
  }
  return files;
}

describe('no production connectivity in source', () => {
  it('does not hardcode mainnet RPC URLs or remote production DB URIs', () => {
    const files = walk(ROOT);
    const violations = [];

    for (const file of files) {
      if (file.endsWith('package-lock.json')) continue;
      if (file.includes(`${path.sep}tests${path.sep}`)) continue;
      const text = fs.readFileSync(file, 'utf8');
      const rel = path.relative(ROOT, file);

      const urlMatches = text.match(/https?:\/\/[^\s"'`]+/g) || [];
      for (const url of urlMatches) {
        if (/mainnet/i.test(url)) {
          violations.push(`${rel}: mainnet URL ${url}`);
        }
      }

      if (/mongodb(\+srv)?:\/\//i.test(text) && !/FORBIDDEN_DB_URIS|assertSandboxSqlitePath|rejects production/.test(text)) {
        violations.push(`${rel}: mongodb URI`);
      }
      if (/postgres(ql)?:\/\//i.test(text) && !/FORBIDDEN_DB_URIS|assertSandboxSqlitePath|DATABASE_URL/.test(text)) {
        violations.push(`${rel}: postgres URI`);
      }
    }

    assert.deepEqual(violations, []);
  });
});
