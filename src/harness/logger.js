const SENSITIVE_KEYS = new Set([
  'ssn',
  'socialsecuritynumber',
  'dob',
  'dateofbirth',
  'phone',
  'phonenumber',
  'emergencycontactphone',
  'email',
  'address',
  'homeaddress',
  'medicalrecordnumber',
  'mrn',
  'insuranceid',
  'insurancepolicynumber',
  'creditcard',
  'bankaccount',
  'password',
  'apikey',
]);

const REDACTED = '***REDACTED***';

// Defense-in-depth for free text fields (clinical notes, incident narratives) that
// were never tagged as a sensitive key but may still contain PII patterns.
const TEXT_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // phone number
  /\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b/g, // email
];

function redactString(value) {
  return TEXT_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, REDACTED), value);
}

function redact(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        out[key] = REDACTED;
      } else {
        out[key] = redact(val);
      }
    }
    return out;
  }
  return value;
}

function log(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  console.log(JSON.stringify(entry));
  return entry;
}

module.exports = { log, redact, SENSITIVE_KEYS };
