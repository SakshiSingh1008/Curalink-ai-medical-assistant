import axios from 'axios';

const OPENALEX_BASE = 'https://api.openalex.org/works';
const EMAIL = 'curalink@research.app'; // polite pool

/**
 * Search OpenAlex and return ranked publications.
 */
export async function searchOpenAlex(query, maxFetch = 100, finalCount = 8) {
  try {
    const perPage = Math.min(maxFetch, 200);
    const pages = Math.ceil(maxFetch / perPage);
    let allResults = [];

    for (let page = 1; page <= Math.min(pages, 2); page++) {
      const url = `${OPENALEX_BASE}?search=${encodeURIComponent(query)}&per-page=${Math.min(perPage, 100)}&page=${page}&sort=relevance_score:desc&filter=from_publication_date:2015-01-01&mailto=${EMAIL}`;
      const res = await axios.get(url, { timeout: 15000 });
      const works = res.data?.results || [];
      allResults = allResults.concat(works);
      if (works.length < perPage) break;
    }

    // Map to standard format
    const mapped = allResults.map(work => {
      const authors = (work.authorships || [])
        .slice(0, 5)
        .map(a => a?.author?.display_name)
        .filter(Boolean);

      const abstract = reconstructAbstract(work.abstract_inverted_index);

      return {
        id: `openalex_${work.id?.replace('https://openalex.org/', '')}`,
        source: 'OpenAlex',
        title: work.title || 'No title',
        abstract: abstract.slice(0, 800),
        authors,
        year: work.publication_year || 'N/A',
        journal: work.primary_location?.source?.display_name || 'OpenAlex',
        url: work.primary_location?.landing_page_url || work.doi ? `https://doi.org/${work.doi}` : null,
        doi: work.doi,
        citationCount: work.cited_by_count || 0,
        openAccess: work.open_access?.is_oa || false,
      };
    }).filter(w => w.title && w.title !== 'No title' && w.abstract);

    // Re-rank: prefer recent + highly cited + has abstract
    mapped.sort((a, b) => {
      const scoreA = rankScore(a);
      const scoreB = rankScore(b);
      return scoreB - scoreA;
    });

    return mapped.slice(0, finalCount);
  } catch (err) {
    console.error('[OpenAlex] Error:', err.message);
    return [];
  }
}

/** Reconstruct abstract from OpenAlex inverted index format */
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.filter(Boolean).join(' ');
}

/** Composite ranking score */
function rankScore(paper) {
  const recency = paper.year && paper.year !== 'N/A'
    ? Math.max(0, (parseInt(paper.year) - 2015) / (2025 - 2015)) * 30
    : 0;
  const citations = Math.min(paper.citationCount / 100, 1) * 40;
  const hasAbstract = paper.abstract ? 20 : 0;
  const openAccess = paper.openAccess ? 10 : 0;
  return recency + citations + hasAbstract + openAccess;
}
