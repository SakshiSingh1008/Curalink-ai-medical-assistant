import axios from 'axios';

const CT_BASE = 'https://clinicaltrials.gov/api/v2/studies';

/**
 * Fetch clinical trials from ClinicalTrials.gov v2 API.
 */
export async function searchClinicalTrials(disease, query = '', location = '', maxFetch = 50, finalCount = 6) {
  try {
    const params = new URLSearchParams({
      'query.cond': disease || query,
      'query.term': query !== disease ? query : '',
      'pageSize': Math.min(maxFetch, 100),
      'format': 'json',
    });

    // Add location filter if provided
    if (location) {
      params.append('query.locn', location);
    }

    // Fetch RECRUITING first
    const recruitingRes = await axios.get(`${CT_BASE}?${params}&filter.overallStatus=RECRUITING`, {
      timeout: 15000,
    }).catch(() => ({ data: { studies: [] } }));

    // Also fetch COMPLETED / ACTIVE_NOT_RECRUITING for comprehensive results
    const completedRes = await axios.get(`${CT_BASE}?${params}&filter.overallStatus=COMPLETED`, {
      timeout: 15000,
    }).catch(() => ({ data: { studies: [] } }));

    const activeRes = await axios.get(`${CT_BASE}?${params}&filter.overallStatus=ACTIVE_NOT_RECRUITING`, {
      timeout: 15000,
    }).catch(() => ({ data: { studies: [] } }));

    const all = [
      ...(recruitingRes.data?.studies || []),
      ...(activeRes.data?.studies || []),
      ...(completedRes.data?.studies || []),
    ];

    // Deduplicate by NCT ID
    const seen = new Set();
    const unique = all.filter(s => {
      const id = s?.protocolSection?.identificationModule?.nctId;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // Map to standard format
    const mapped = unique.map(study => {
      const id = study?.protocolSection;
      const identification = id?.identificationModule || {};
      const status = id?.statusModule || {};
      const desc = id?.descriptionModule || {};
      const eligibility = id?.eligibilityModule || {};
      const contacts = id?.contactsLocationsModule || {};

      const nctId = identification.nctId || '';
      const locations = (contacts.locations || []).slice(0, 3).map(loc => ({
        facility: loc.facility || '',
        city: loc.city || '',
        country: loc.country || '',
      }));

      const centralContacts = (contacts.centralContacts || []).slice(0, 2).map(c => ({
        name: c.name || '',
        email: c.email || '',
        phone: c.phone || '',
      }));

      return {
        id: `ct_${nctId}`,
        source: 'ClinicalTrials.gov',
        nctId,
        title: identification.briefTitle || identification.officialTitle || 'No title',
        status: status.overallStatus || 'Unknown',
        phase: status.phase || id?.designModule?.phases?.join(', ') || 'N/A',
        brief: desc.briefSummary?.slice(0, 500) || '',
        eligibility: eligibility.eligibilityCriteria?.slice(0, 600) || '',
        minAge: eligibility.minimumAge || 'N/A',
        maxAge: eligibility.maximumAge || 'N/A',
        sex: eligibility.sex || 'All',
        startDate: status.startDateStruct?.date || 'N/A',
        completionDate: status.completionDateStruct?.date || status.primaryCompletionDateStruct?.date || 'N/A',
        sponsor: id?.sponsorCollaboratorsModule?.leadSponsor?.name || 'N/A',
        locations,
        contacts: centralContacts,
        url: nctId ? `https://clinicaltrials.gov/study/${nctId}` : null,
      };
    }).filter(t => t.title && t.title !== 'No title');

    // Rank: recruiting first, then by recency
    mapped.sort((a, b) => {
      if (a.status === 'RECRUITING' && b.status !== 'RECRUITING') return -1;
      if (b.status === 'RECRUITING' && a.status !== 'RECRUITING') return 1;
      return 0;
    });

    return mapped.slice(0, finalCount);
  } catch (err) {
    console.error('[ClinicalTrials] Error:', err.message);
    return [];
  }
}
