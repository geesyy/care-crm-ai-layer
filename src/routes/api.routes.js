const { Router } = require('express');
const intakeController = require('../controllers/intake.controller');
const incidentController = require('../controllers/incident.controller');
const harnessController = require('../controllers/harness.controller');

const router = Router();

router.post('/intake', intakeController.submitIntake);
router.get('/intake/:intakeId/audit', intakeController.getIntakeAudit);

router.post('/incidents', incidentController.submitIncident);
router.get('/incidents/:incidentId/audit', incidentController.getIncidentAudit);

router.post('/harness/demo', harnessController.runHarnessDemo);

module.exports = router;
