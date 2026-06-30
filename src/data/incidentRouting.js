// Deterministic routing table. The LLM only classifies the incident (type +
// severity) — which regulatory path that classification triggers is a fixed
// business rule, not something we want an LLM improvising on a compliance-critical path.
const ROUTES = {
  fall: {
    low: {
      notificationPath: 'internal_log_only',
      recipients: ['facility_administrator'],
      deadlineHours: 72,
      requiredFields: ['residentId', 'dateTime', 'location', 'description', 'staffInvolved'],
    },
    high: {
      notificationPath: 'state_health_department',
      recipients: ['facility_administrator', 'state_health_department', 'family_contact'],
      deadlineHours: 24,
      requiredFields: [
        'residentId',
        'dateTime',
        'location',
        'description',
        'staffInvolved',
        'injuriesObserved',
        'physicianNotified',
        'familyNotified',
      ],
    },
  },
  medication_error: {
    low: {
      notificationPath: 'pharmacy_consultant_review',
      recipients: ['facility_administrator', 'pharmacy_consultant'],
      deadlineHours: 48,
      requiredFields: ['residentId', 'dateTime', 'medicationName', 'errorType', 'staffInvolved'],
    },
    high: {
      notificationPath: 'state_health_department',
      recipients: ['facility_administrator', 'state_health_department', 'pharmacy_consultant', 'family_contact'],
      deadlineHours: 24,
      requiredFields: [
        'residentId',
        'dateTime',
        'medicationName',
        'errorType',
        'staffInvolved',
        'physicianNotified',
        'familyNotified',
        'correctiveAction',
      ],
    },
  },
  elopement: {
    low: {
      notificationPath: 'internal_log_only',
      recipients: ['facility_administrator'],
      deadlineHours: 24,
      requiredFields: ['residentId', 'dateTime', 'description', 'staffInvolved', 'durationMinutes'],
    },
    high: {
      notificationPath: 'state_health_department_and_law_enforcement',
      recipients: ['facility_administrator', 'state_health_department', 'law_enforcement', 'family_contact'],
      deadlineHours: 2,
      requiredFields: [
        'residentId',
        'dateTime',
        'description',
        'staffInvolved',
        'durationMinutes',
        'lawEnforcementNotified',
        'familyNotified',
      ],
    },
  },
  injury: {
    low: {
      notificationPath: 'internal_log_only',
      recipients: ['facility_administrator'],
      deadlineHours: 72,
      requiredFields: ['residentId', 'dateTime', 'location', 'description', 'staffInvolved'],
    },
    high: {
      notificationPath: 'state_health_department',
      recipients: ['facility_administrator', 'state_health_department', 'family_contact'],
      deadlineHours: 24,
      requiredFields: [
        'residentId',
        'dateTime',
        'location',
        'description',
        'staffInvolved',
        'injuriesObserved',
        'physicianNotified',
        'familyNotified',
      ],
    },
  },
  death: {
    low: {
      notificationPath: 'state_health_department_and_medical_examiner',
      recipients: ['facility_administrator', 'state_health_department', 'medical_examiner', 'family_contact'],
      deadlineHours: 2,
      requiredFields: [
        'residentId',
        'dateTime',
        'location',
        'description',
        'physicianNotified',
        'familyNotified',
        'medicalExaminerNotified',
      ],
    },
    high: {
      notificationPath: 'state_health_department_and_medical_examiner',
      recipients: [
        'facility_administrator',
        'state_health_department',
        'medical_examiner',
        'law_enforcement',
        'family_contact',
      ],
      deadlineHours: 2,
      requiredFields: [
        'residentId',
        'dateTime',
        'location',
        'description',
        'physicianNotified',
        'familyNotified',
        'medicalExaminerNotified',
        'lawEnforcementNotified',
      ],
    },
  },
  behavioral: {
    low: {
      notificationPath: 'internal_log_only',
      recipients: ['facility_administrator'],
      deadlineHours: 72,
      requiredFields: ['residentId', 'dateTime', 'description', 'staffInvolved'],
    },
    high: {
      notificationPath: 'internal_review_board',
      recipients: ['facility_administrator', 'care_review_board', 'family_contact'],
      deadlineHours: 24,
      requiredFields: ['residentId', 'dateTime', 'description', 'staffInvolved', 'physicianNotified', 'familyNotified'],
    },
  },
  property_damage: {
    low: {
      notificationPath: 'internal_log_only',
      recipients: ['facility_administrator'],
      deadlineHours: 72,
      requiredFields: ['dateTime', 'location', 'description'],
    },
    high: {
      notificationPath: 'internal_log_only',
      recipients: ['facility_administrator'],
      deadlineHours: 48,
      requiredFields: ['dateTime', 'location', 'description', 'estimatedCost'],
    },
  },
  other: {
    low: {
      notificationPath: 'internal_log_only',
      recipients: ['facility_administrator'],
      deadlineHours: 72,
      requiredFields: ['dateTime', 'description'],
    },
    high: {
      notificationPath: 'internal_review_board',
      recipients: ['facility_administrator', 'care_review_board'],
      deadlineHours: 24,
      requiredFields: ['dateTime', 'description', 'staffInvolved'],
    },
  },
};

function resolveRoute(incidentType, severity) {
  const byType = ROUTES[incidentType] || ROUTES.other;
  const bySeverity = severity === 'high' || severity === 'critical' ? 'high' : 'low';
  return { incidentType, severity: bySeverity, ...byType[bySeverity] };
}

module.exports = { ROUTES, resolveRoute };
