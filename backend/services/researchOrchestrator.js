import { searchPubMed } from './pubmedService.js';
import { searchOpenAlex } from './openAlexService.js';
import { searchClinicalTrials } from './clinicalTrialsService.js';
import { expandQuery } from './llmService.js';

/**
 * Orchestrate research retrieval from all sources.
 * - Expands query intelligently
 * - Fetches large pool in parallel
 * - Merges, deduplicates, and re-ranks
 */
export async function orchestrateResearch({ disease, query, location, intent }) {
  // Step 1: Expand query
  const expandedQuery = [
  disease,
  query,
  'treatment',
  'clinical trial',
  'therapy'
]
.filter(Boolean)
.join(' ');
  console.log(`[Research] Expanded query: "${expandedQuery}"`);

  // Step 2: Parallel fetch from all sources (large pool)
// Step 2: Build safe query FIRST
const safeQuery =
  expandedQuery?.length > 5
    ? expandedQuery
    : `${disease || 'diabetes'} treatment clinical study`;

console.log("🔍 SAFE QUERY:", safeQuery);

// Step 3: Parallel fetch from all sources
const [pubmedResults, openAlexResults, clinicalTrialsResults] =
  await Promise.allSettled([
    searchPubMed(safeQuery, 80, 8),
    searchOpenAlex(safeQuery, 80, 8),
    searchClinicalTrials(disease || 'diabetes', safeQuery, location, 50, 6),
  ]);

  const publications = mergeAndRankPublications(
    pubmedResults.value || [],
    openAlexResults.value || []
  );

  const clinicalTrials = clinicalTrialsResults.value || [];

  console.log(`[Research] Retrieved: ${publications.length} publications, ${clinicalTrials.length} trials`);

  return {
    expandedQuery,
    publications,
    clinicalTrials,
  };
}

/**
 * Merge PubMed + OpenAlex results, deduplicate by title similarity, re-rank.
 */
function mergeAndRankPublications(pubmedResults, openAlexResults) {
  const allPubs = [...pubmedResults, ...openAlexResults];

  // Deduplicate by title similarity
  const seen = new Set();
  const deduped = allPubs.filter(pub => {
    const key = normalizeTitle(pub.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Re-rank by composite score
  deduped.sort((a, b) => compositeScore(b) - compositeScore(a));

  return deduped.slice(0, 8);
}

function normalizeTitle(title = '') {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
}

function compositeScore(pub) {
  let score = 0;

  // Recency score (0-40)
  const year = parseInt(pub.year) || 2000;
  score += Math.max(0, (year - 2000) / (2025 - 2000)) * 40;

  // Has abstract (0-25)
  if (pub.abstract && pub.abstract.length > 100) score += 25;

  // Citation count (0-20)
  if (pub.citationCount) score += Math.min(pub.citationCount / 50, 1) * 20;

  // Open access (0-10)
  if (pub.openAccess) score += 10;

  // Has URL (0-5)
  if (pub.url) score += 5;

  return score;
}
