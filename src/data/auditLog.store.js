// In-memory, append-only audit trail. Lost on restart — see README "Limitações"
// for the production-grade replacement (durable, immutable audit store).
const entries = [];

function append(entry) {
  const record = { ...entry, timestamp: new Date().toISOString() };
  entries.push(record);
  return record;
}

function getByEntityId(entityId) {
  return entries.filter((e) => e.entityId === entityId);
}

function all() {
  return entries.slice();
}

module.exports = { append, getByEntityId, all };
