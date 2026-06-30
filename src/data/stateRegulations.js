// Mock regulatory ground truth for residential care facilities, by US state.
// In production this would come from a maintained compliance database, not
// hardcoded values — the point here is to give the compliance sub-agent a
// concrete source of truth to validate against instead of letting the LLM
// guess at regulations from training data.
const STATE_REGULATIONS = {
  CA: {
    agencyName: 'California Department of Social Services (CCLD)',
    minStaffToResidentRatio: '1:6 (day shift)',
    requiredCarePlanElements: [
      'fall risk assessment',
      'medication management plan',
      'dietary restrictions',
      'emergency contact and physician of record',
      'advance directive on file',
    ],
    incidentReportDeadlineHours: 24,
  },
  TX: {
    agencyName: 'Texas Health and Human Services Commission (HHSC)',
    minStaffToResidentRatio: '1:8 (day shift)',
    requiredCarePlanElements: [
      'fall risk assessment',
      'medication management plan',
      'physician of record',
      'emergency contact',
    ],
    incidentReportDeadlineHours: 24,
  },
  FL: {
    agencyName: 'Florida Agency for Health Care Administration (AHCA)',
    minStaffToResidentRatio: '1:5 (day shift)',
    requiredCarePlanElements: [
      'fall risk assessment',
      'medication management plan',
      'dietary restrictions',
      'emergency contact and physician of record',
    ],
    incidentReportDeadlineHours: 12,
  },
  NY: {
    agencyName: 'New York State Department of Health (DOH)',
    minStaffToResidentRatio: '1:7 (day shift)',
    requiredCarePlanElements: [
      'fall risk assessment',
      'medication management plan',
      'dietary restrictions',
      'emergency contact and physician of record',
      'advance directive on file',
      'cognitive assessment',
    ],
    incidentReportDeadlineHours: 24,
  },
};

function getStateRegulations(stateCode) {
  return STATE_REGULATIONS[stateCode?.toUpperCase()] || null;
}

module.exports = { STATE_REGULATIONS, getStateRegulations };
