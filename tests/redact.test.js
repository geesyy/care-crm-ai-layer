const test = require('node:test');
const assert = require('node:assert/strict');
const { redact } = require('../src/harness/logger');

test('redacts sensitive field names regardless of case', () => {
  const input = { name: 'Jane Doe', SSN: '123-45-6789', dob: '1950-01-01', notes: 'ok' };
  const out = redact(input);
  assert.equal(out.SSN, '***REDACTED***');
  assert.equal(out.dob, '***REDACTED***');
  assert.equal(out.name, 'Jane Doe');
});

test('redacts SSN and email patterns embedded in free text fields', () => {
  const input = { notes: 'Contact at jane.doe@example.com or SSN 123-45-6789 for follow up.' };
  const out = redact(input);
  assert.ok(!out.notes.includes('123-45-6789'));
  assert.ok(!out.notes.includes('jane.doe@example.com'));
});

test('redacts nested objects and arrays', () => {
  const input = { resident: { phone: '555-123-4567', tags: ['a', { email: 'x@y.com' }] } };
  const out = redact(input);
  assert.equal(out.resident.phone, '***REDACTED***');
  assert.equal(out.resident.tags[1].email, '***REDACTED***');
});

test('leaves non-sensitive fields untouched', () => {
  const input = { conditions: ['diabetes'], riskFlags: ['fall risk'] };
  const out = redact(input);
  assert.deepEqual(out, input);
});
