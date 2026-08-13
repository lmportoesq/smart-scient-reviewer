import { PubMedProvider } from './pubmed.provider';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('PubMedProvider', () => {
  let provider: PubMedProvider;

  beforeEach(() => {
    provider = new PubMedProvider();
    mockFetch.mockReset();
  });

  describe('verify', () => {
    it('should return NOT_APPLICABLE when no DOI and no PMID', async () => {
      const result = await provider.verify({ title: 'Test' });
      expect(result.status).toBe('NOT_APPLICABLE');
    });

    it('should return NOT_FOUND when PMID not in PubMed (not suspicious per spec §13)', async () => {
      // Search by DOI returns nothing
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          esearchresult: { count: '0', idlist: [] },
        }),
      });

      const result = await provider.verify({ doi: '10.1234/not-biomedical' });

      expect(result.status).toBe('NOT_FOUND');
      expect(result.signals).toHaveLength(0); // Not suspicious!
      expect(result.metadata).toHaveProperty('note');
    });

    it('should verify paper with PMID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            '12345678': {
              uid: '12345678',
              title: 'A Biomedical Paper',
              source: 'Nature Medicine',
              pubdate: '2023 Jan',
              authors: [{ name: 'Smith J', authtype: 'Author' }],
              pubtype: ['Journal Article'],
              articleids: [
                { idtype: 'doi', value: '10.1038/nm.1234' },
              ],
            },
          },
        }),
      });

      const result = await provider.verify({
        pmid: '12345678',
        title: 'A Biomedical Paper',
        journal: 'Nature Medicine',
      });

      expect(result.status).toBe('VERIFIED');
      expect(result.metadata).toHaveProperty('pmid', '12345678');
    });

    it('should detect retraction in PubMed pubtype', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            '99999999': {
              uid: '99999999',
              title: 'Retracted Paper',
              source: 'Some Journal',
              pubdate: '2020',
              authors: [],
              pubtype: ['Journal Article', 'Retracted Publication'],
              articleids: [],
            },
          },
        }),
      });

      const result = await provider.verify({ pmid: '99999999' });

      expect(result.status).toBe('ALERT');
      const retractionSignal = result.signals.find((s) => s.type === 'SIGNAL-003');
      expect(retractionSignal).toBeDefined();
      expect(retractionSignal!.severity).toBe('CRITICAL');
    });

    it('should detect expression of concern', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            '88888888': {
              uid: '88888888',
              title: 'Concerning Paper',
              source: 'Journal X',
              pubdate: '2021',
              authors: [],
              pubtype: ['Journal Article', 'Expression of Concern'],
              articleids: [],
            },
          },
        }),
      });

      const result = await provider.verify({ pmid: '88888888' });

      const signal = result.signals.find((s) => s.type === 'SIGNAL-004');
      expect(signal).toBeDefined();
      expect(signal!.severity).toBe('HIGH');
    });

    it('should return ERROR when PubMed API fails', async () => {
      mockFetch.mockRejectedValue(new Error('NCBI unavailable'));

      const result = await provider.verify({ pmid: '12345678' });
      expect(result.status).toBe('ERROR');
    });

    it('should search by DOI when no PMID provided', async () => {
      // First call: esearch by DOI → returns PMID
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          esearchresult: { count: '1', idlist: ['55555555'] },
        }),
      });
      // Second call: esummary with found PMID
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            '55555555': {
              uid: '55555555',
              title: 'Found via DOI',
              source: 'Cell',
              pubdate: '2022',
              authors: [{ name: 'Jones A' }],
              pubtype: ['Journal Article'],
              articleids: [{ idtype: 'doi', value: '10.1016/j.cell.2022' }],
            },
          },
        }),
      });

      const result = await provider.verify({ doi: '10.1016/j.cell.2022' });

      expect(result.status).toBe('VERIFIED');
      expect(result.metadata).toHaveProperty('pmid', '55555555');
    });
  });
});
