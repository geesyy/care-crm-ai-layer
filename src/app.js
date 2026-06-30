const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api.routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({
    service: 'care-crm-ai-layer',
    version: '1.0.0',
    endpoints: {
      submitIntake: 'POST /api/intake',
      intakeAudit: 'GET /api/intake/:intakeId/audit',
      submitIncident: 'POST /api/incidents',
      incidentAudit: 'GET /api/incidents/:incidentId/audit',
      harnessDemo: 'POST /api/harness/demo',
    },
  });
});

app.use('/api', apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
