const test = require('node:test');
const assert = require('node:assert/strict');
const { runIncidentWorkflow } = require('../src/workflows/incident.workflow');
const config = require('../src/config');

test('escalates to a human reviewer when validation never converges', async () => {
  const result = await runIncidentWorkflow({
    description: 'Resident wandered off the property for 45 minutes.',
    state: 'TX',
    incidentReport: { residentId: 'RES-1', dateTime: '2026-06-20T23:15:00-05:00' },
    simulate: {
      classifier: {
        type: 'rate_limit',
        failCount: 0,
        successValue: { type: 'elopement', severity: 'high', confidence: 0.9, rationale: 'extended unsupervised absence' },
      },
      validator: {
        type: 'rate_limit',
        failCount: 0,
        successValue: { complete: false, missingFields: ['familyNotified'], clarifyingQuestions: ['Was family notified?'] },
      },
    },
  });

  assert.equal(result.status, 'escalated_to_human');
  assert.equal(result.iterations, config.incident.maxValidationIterations);
  assert.ok(result.auditTrail.some((e) => e.step === 'escalated'));
  assert.equal(
    result.auditTrail.filter((e) => e.step === 'validation_iteration').length,
    config.incident.maxValidationIterations
  );
});

test('completes without escalation once validation reports complete', async () => {
  const result = await runIncidentWorkflow({
    description: 'Resident had a minor fall, no injuries.',
    state: 'CA',
    incidentReport: {
      residentId: 'RES-2',
      dateTime: '2026-06-20T08:00:00-07:00',
      location: 'Room 5',
      staffInvolved: 'A. Lee',
    },
    simulate: {
      classifier: {
        type: 'rate_limit',
        failCount: 0,
        successValue: { type: 'fall', severity: 'low', confidence: 0.95, rationale: 'contained, no injury' },
      },
      validator: {
        type: 'rate_limit',
        failCount: 0,
        successValue: { complete: true, missingFields: [], clarifyingQuestions: [] },
      },
    },
  });

  assert.equal(result.status, 'validated');
  assert.equal(result.iterations, 1);
});
