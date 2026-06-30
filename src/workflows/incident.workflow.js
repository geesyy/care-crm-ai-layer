const { v4: uuidv4 } = require('uuid');
const { runIncidentClassifierAgent } = require('../agents/incidentClassifier.agent');
const { runIncidentValidatorAgent } = require('../agents/incidentValidator.agent');
const { resolveRoute } = require('../data/incidentRouting');
const auditLog = require('../data/auditLog.store');
const config = require('../config');

async function runIncidentWorkflow(payload) {
  const incidentId = uuidv4();
  const { description, state, incidentReport = {}, simulate } = payload;

  auditLog.append({ entityId: incidentId, entityType: 'incident', step: 'started', state });

  const classification = await runIncidentClassifierAgent({
    description,
    state,
    simulate: simulate?.classifier,
  });
  auditLog.append({ entityId: incidentId, entityType: 'incident', step: 'classified', ...classification });

  const route = resolveRoute(classification.type, classification.severity);
  auditLog.append({
    entityId: incidentId,
    entityType: 'incident',
    step: 'routed',
    notificationPath: route.notificationPath,
    requiredFields: route.requiredFields,
    deadlineHours: route.deadlineHours,
  });

  const currentReport = { description, state, ...incidentReport };
  const maxIterations = config.incident.maxValidationIterations;

  let validation;
  let attempts = 0;

  // Looping validation step with a hard max-iteration guard. In a real product,
  // an incomplete result would be sent back to the staff member with
  // clarifyingQuestions and re-submitted; this demo has no human-in-the-loop
  // between iterations, so a report that's missing a field nobody re-supplies
  // will legitimately never converge — which is exactly what should trip the guard.
  while (attempts < maxIterations) {
    attempts += 1;
    validation = await runIncidentValidatorAgent({
      requiredFields: route.requiredFields,
      incidentReport: currentReport,
      simulate: simulate?.validator,
    });
    auditLog.append({
      entityId: incidentId,
      entityType: 'incident',
      step: 'validation_iteration',
      iteration: attempts,
      complete: validation.complete,
      missingFields: validation.missingFields,
    });
    if (validation.complete) break;
  }

  if (!validation.complete) {
    auditLog.append({
      entityId: incidentId,
      entityType: 'incident',
      step: 'escalated',
      reason: 'max_iterations_exceeded',
      iterations: attempts,
      missingFields: validation.missingFields,
    });
    return {
      incidentId,
      classification,
      route,
      status: 'escalated_to_human',
      iterations: attempts,
      missingFields: validation.missingFields,
      clarifyingQuestions: validation.clarifyingQuestions,
      auditTrail: auditLog.getByEntityId(incidentId),
    };
  }

  auditLog.append({ entityId: incidentId, entityType: 'incident', step: 'completed', iterations: attempts });

  return {
    incidentId,
    classification,
    route,
    status: 'validated',
    iterations: attempts,
    auditTrail: auditLog.getByEntityId(incidentId),
  };
}

module.exports = { runIncidentWorkflow };
