const { runIncidentWorkflow } = require('../workflows/incident.workflow');
const auditLog = require('../data/auditLog.store');
const { ValidationError } = require('../utils/errors');

async function submitIncident(req, res, next) {
  try {
    const { description, state } = req.body;
    if (!description || !state) {
      throw new ValidationError('description and state are required');
    }
    const result = await runIncidentWorkflow(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

function getIncidentAudit(req, res) {
  res.json({ entries: auditLog.getByEntityId(req.params.incidentId) });
}

module.exports = { submitIncident, getIncidentAudit };
