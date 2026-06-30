const { runIntakeWorkflow } = require('../workflows/intake.workflow');
const auditLog = require('../data/auditLog.store');
const { ValidationError } = require('../utils/errors');

async function submitIntake(req, res, next) {
  try {
    const { resident, clinicalNotes, carePlan } = req.body;
    if (!resident?.firstName || !resident?.state) {
      throw new ValidationError('resident.firstName and resident.state are required');
    }
    if (!carePlan?.narrative) {
      throw new ValidationError('carePlan.narrative is required');
    }
    const result = await runIntakeWorkflow(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

function getIntakeAudit(req, res) {
  res.json({ entries: auditLog.getByEntityId(req.params.intakeId) });
}

module.exports = { submitIntake, getIntakeAudit };
