import { OpenAlexProvider } from './openalex.provider';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('OpenAlexProvider', () => {
  let provider: OpenAlexProvider;

  beforeEach(() => {
    provider = new OpenAlexProvider();
    mockFetch.mockReset();
  });

  describe('verify', () => {
    it('should return NOT_APPLICABLE when no DOI provided', async () => {
      const result = await provider.verify({ title: 'Test' });
      expect(result.status).toBe('NOT_APPLICABLE');
    });

    it('should return NOT_FOUND when DOI not in OpenAlex', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      const result = await provider.verify({ doi: '10.1234/fake' });
      expect(result.status).toBe('NOT_FOUND');
    });

    it('should return VERIFIED for a valid paper', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'https://openalex.org/W123',
          doi: 'https://doi.org/10.1038/nature12373',
          title: 'Test Paper Title',
          display_name: 'Test Paper Title',
          publication_year: 2023,
          primary_location: {
            source: { display_name: 'Nature', issn_l: '0028-0836' },
          },
          authorships: [
            { author: { display_name: 'John Doe', id: 'A1' } },
          ],
          cited_by_count: 42,
          is_retracted: false,
          referenced_works: ['W1', 'W2'],
          type: 'article',
        }),
      });

      const result = await provider.verify({
        doi: '10.1038/nature12373',
        title: 'Test Paper Title',
        year: 2023,
        journal: 'Nature',
      });

      expect(result.provider).toBe('openalex');
      expect(result.status).toBe('VERIFIED');
      expect(result.metadata).toHaveProperty('citedByCount', 42);
    });

    it('should detect retraction via is_retracted flag', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'https://openalex.org/W456',
          doi: 'https://doi.org/10.1016/retracted',
          title: 'Retracted Paper',
          publication_year: 2020,
          is_retracted: true,
          authorships: [],
        }),
      });

      const result = await provider.verify({ doi: '10.1016/retracted' });

      expect(result.status).toBe('ALERT');
      const retractionSignal = result.signals.find((s) => s.type === 'SIGNAL-003');
      expect(retractionSignal).toBeDefined();
      expect(retractionSignal!.severity).toBe('CRITICAL');
    });

    it('should detect metadata mismatch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'https://openalex.org/W789',
          doi: 'https://doi.org/10.1038/nature12373',
          title: 'Completely Different Title',
          publication_year: 2019,
          is_retracted: false,
          authorships: [],
          primary_location: {
            source: { display_name: 'Science' },
          },
        }),
      });

      const result = await provider.verify({
        doi: '10.1038/nature12373',
        title: 'My Paper',
        year: 2023,
        journal: 'Nature',
      });

      expect(result.status).toBe('MISMATCH');
    });

    it('should return ERROR when API fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.verify({ doi: '10.1038/nature12373' });
      expect(result.status).toBe('ERROR');
    });
  });
});
