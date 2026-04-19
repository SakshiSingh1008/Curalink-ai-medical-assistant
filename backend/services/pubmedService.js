import axios from 'axios';
import xml2js from 'xml2js';

const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const API_KEY = process.env.PUBMED_API_KEY || '';
const keyParam = API_KEY ? `&api_key=${API_KEY}` : '';

/**
 * Search PubMed and return top N articles with full metadata.
 * @param {string} query - expanded search query
 * @param {number} maxFetch - how many IDs to retrieve before ranking
 * @param {number} finalCount - how many to return after filtering
 */
export async function searchPubMed(query, maxFetch = 100, finalCount = 8) {
  try {
    // Step 1: Search for IDs
    const searchUrl = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxFetch}&sort=pub+date&retmode=json${keyParam}`;
    const searchRes = await axios.get(searchUrl, { timeout: 15000 });
    const ids = searchRes.data?.esearchresult?.idlist || [];

    if (ids.length === 0) return [];

    // Step 2: Fetch details for all IDs
    const idsToFetch = ids.slice(0, Math.min(ids.length, 50)); // cap XML fetch at 50
    const fetchUrl = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${idsToFetch.join(',')}&retmode=xml${keyParam}`;
    const fetchRes = await axios.get(fetchUrl, { timeout: 20000 });

    // Step 3: Parse XML
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    const parsed = await parser.parseStringPromise(fetchRes.data);

    const articles = parsed?.PubmedArticleSet?.PubmedArticle;
    if (!articles) return [];

    const articleArr = Array.isArray(articles) ? articles : [articles];

    // Step 4: Map to standard format
    const results = articleArr.map(article => {
      const medline = article?.MedlineCitation;
      const art = medline?.Article;
      const pmid = medline?.PMID?._ || medline?.PMID || '';

      // Title
      const title = art?.ArticleTitle?._ || art?.ArticleTitle || 'No title';

      // Abstract
      let abstract = '';
      const abstractObj = art?.Abstract?.AbstractText;
      if (typeof abstractObj === 'string') abstract = abstractObj;
      else if (Array.isArray(abstractObj)) abstract = abstractObj.map(a => a?._ || a).join(' ');
      else if (abstractObj?._) abstract = abstractObj._;

      // Authors
      const authorList = art?.AuthorList?.Author;
      let authors = [];
      if (authorList) {
        const arr = Array.isArray(authorList) ? authorList : [authorList];
        authors = arr.slice(0, 5).map(a => {
          const last = a?.LastName || '';
          const fore = a?.ForeName || a?.Initials || '';
          return `${last} ${fore}`.trim();
        }).filter(Boolean);
      }

      // Year
      const pubDate = art?.Journal?.JournalIssue?.PubDate;
      const year = pubDate?.Year || pubDate?.MedlineDate?.slice(0, 4) || 'N/A';

      // Journal
      const journal = art?.Journal?.Title || art?.Journal?.ISOAbbreviation || 'PubMed';

      return {
        id: `pubmed_${pmid}`,
        source: 'PubMed',
        title: String(title).trim(),
        abstract: abstract.trim().slice(0, 800),
        authors,
        year,
        journal,
        url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null,
        pmid,
      };
    }).filter(a => a.title && a.title !== 'No title');

    return results.slice(0, finalCount);
  } catch (err) {
    console.error('[PubMed] Error:', err.message);
    return [];
  }
}
