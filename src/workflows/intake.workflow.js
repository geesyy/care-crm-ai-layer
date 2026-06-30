const { v4: uuidv4 } = require('uuid');
const { runMedicalHistoryAgent } = require('../agents/medicalHistory.agent');
const { runRegulatoryComplianceAgent } = require('../agents/regulatoryCompliance.agent');
const { runFamilyCommunicationAgent } = require('../agents/familyCommunication.agent');
const auditLog = require('../data/auditLog.store');

// Demo/test hook only: forces one named sub-agent to exhaust retries and fail,
// without touching the real Anthropic API, so the "orchestrator survives a
// sub-agent failure" path can be demonstrated deterministically.
function buildSimulateFor(agentName, simulateFailure) {
  if (simulateFailure !== agentName) return undefined;
  return { type: 'server_error', failCount: 999 };
}

async function runIntakeWorkflow(payload) {
  const intakeId = uuidv4();
  const { resident, clinicalNotes, carePlan, simulateFailure } = payload;

  auditLog.append({
    entityId: intakeId,
    entityType: 'intake',
    step: 'started',
    resident: `${resident.firstName} ${resident.lastName}`,
    state: resident.state,
  });

  const results = {};
  const incompleteAgents = [];

  // medicalHistory and regulatoryCompliance are independent — run them concurrently.
  const [medicalOutcome, complianceOutcome] = await Promise.allSettled([
    runMedicalHistoryAgent({
      clinicalNotes,
      simulate: buildSimulateFor('medicalHistory', simulateFailure),
    }),
    runRegulatoryComplianceAgent({
      state: resident.state,
      carePlanNarrative: carePlan.narrative,
      documentedElements: carePlan.documentedElements,
      simulate: buildSimulateFor('regulatoryCompliance', simulateFailure),
    }),
  ]);

  if (medicalOutcome.status === 'fulfilled') {
    results.medicalHistory = medicalOutcome.value;
    auditLog.append({ entityId: intakeId, entityType: 'intake', step: 'agent_completed', agent: 'medicalHistory' });
  } else {
    incompleteAgents.push({ agent: 'medicalHistory', reason: medicalOutcome.reason?.message || 'unknown error' });
    auditLog.append({
      entityId: intakeId,
      entityType: 'intake',
      step: 'agent_failed',
      agent: 'medicalHistory',
      reason: medicalOutcome.reason?.message,
    });
  }

  if (complianceOutcome.status === 'fulfilled') {
    results.regulatoryCompliance = complianceOutcome.value;
    auditLog.append({ entityId: intakeId, entityType: 'intake', step: 'agent_completed', agent: 'regulatoryCompliance' });
  } else {
    incompleteAgents.push({ agent: 'regulatoryCompliance', reason: complianceOutcome.reason?.message || 'unknown error' });
    auditLog.append({
      entityId: intakeId,
      entityType: 'intake',
      step: 'agent_failed',
      agent: 'regulatoryCompliance',
      reason: complianceOutcome.reason?.message,
    });
  }

  // familyCommunication prefers the medical summary but degrades gracefully without it.
  try {
    const familyResult = await runFamilyCommunicationAgent({
      residentFirstName: resident.firstName,
      carePlanNarrative: carePlan.narrative,
      medicalSummary: results.medicalHistory?.summary,
      simulate: buildSimulateFor('familyCommunication', simulateFailure),
    });
    results.familyCommunication = familyResult;
    auditLog.append({
      entityId: intakeId,
      entityType: 'intake',
      step: 'agent_completed',
      agent: 'familyCommunication',
      degraded: !results.medicalHistory,
    });
  } catch (err) {
    incompleteAgents.push({ agent: 'familyCommunication', reason: err.message });
    auditLog.append({
      entityId: intakeId,
      entityType: 'intake',
      step: 'agent_failed',
      agent: 'familyCommunication',
      reason: err.message,
    });
  }

  const completedAgents = Object.keys(results);
  auditLog.append({
    entityId: intakeId,
    entityType: 'intake',
    step: 'completed',
    completedAgents,
    incompleteAgents: incompleteAgents.map((a) => a.agent),
  });

  return {
    intakeId,
    resident: { firstName: resident.firstName, lastName: resident.lastName, state: resident.state },
    completedAgents,
    incompleteAgents,
    requiresHumanReview: incompleteAgents.length > 0,
    results,
  };
}

module.exports = { runIntakeWorkflow };
