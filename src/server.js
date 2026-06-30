const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`[care-crm-ai-layer] listening on http://localhost:${config.port}`);
});
