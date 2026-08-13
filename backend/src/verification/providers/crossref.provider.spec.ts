import { CrossrefProvider } from './crossref.provider';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('CrossrefProvider', () => {
  let provider: CrossrefProvider;

  beforeEach(() => {
    provider = new CrossrefProvider();
    mockFetch.mockReset();
  });

  describe('verify', () => {
    it('should return NOT_APPLICABLE when no DOI provided', async () => {
      const result = await provider.verify({ title: 'Test Paper' });

      expect(result.provider).toBe('crossref');
      expect(result.status).toBe('NOT_APPLICABLE');
      expect(result.signals).toHaveLength(0);
    });

    it('should return NOT_FOUND when DOI does not exist', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await provider.verify({ doi: '10.1234/fake-doi' });

      expect(result.status).toBe('NOT_FOUND');
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].type).toBe('SIGNAL-001');
    });

    it('should return VERIFIED for a valid paper', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          'message-type': 'work',
          message: {
            DOI: '10.1038/nature12373',
            title: ['A test paper title'],
            author: [{ given: 'John', family: 'Doe' }],
            'container-title': ['Nature'],
            published: { 'date-parts': [[2023]] },
            publisher: 'Springer Nature',
            type: 'journal-article',
          },
        }),
      });

      const result = await provider.verify({
        doi: '10.1038/nature12373',
        title: 'A test paper title',
        year: 2023,
        journal: 'Nature',
      });

      expect(result.provider).toBe('crossref');
      expect(result.status).toBe('VERIFIED');
      expect(result.signals.length).toBeGreaterThanOrEqual(1);

      // Should have DOI verified signal
      const doiSignal = result.signals.find((s) => s.type === 'SIGNAL-001');
      expect(doiSignal).toBeDefined();
      expect(doiSignal!.title).toContain('verified');
    });

    it('should detect retraction signal', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          'message-type': 'work',
          message: {
            DOI: '10.1016/retracted.2020',
            title: ['Retracted paper'],
            publisher: 'Elsevier',
            'update-to': [
              {
                DOI: '10.1016/retraction-notice',
                type: 'retraction',
                label: 'Retraction',
                updated: { 'date-parts': [[2021, 3, 15]] },
              },
            ],
          },
        }),
      });

      const result = await provider.verify({ doi: '10.1016/retracted.2020' });

      expect(result.status).toBe('ALERT');

      const retractionSignal = result.signals.find((s) => s.type === 'SIGNAL-003');
      expect(retractionSignal).toBeDefined();
      expect(retractionSignal!.severity).toBe('CRITICAL');
      expect(retractionSignal!.title).toContain('Retraction');
    });

    it('should detect expression of concern', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          'message-type': 'work',
          message: {
            DOI: '10.1016/concern.2020',
            title: ['Concerning paper'],
            publisher: 'Elsevier',
            'update-to': [
              {
                DOI: '10.1016/concern-notice',
                type: 'expression-of-concern',
                label: 'Expression of Concern',
                updated: { 'date-parts': [[2022, 1, 10]] },
              },
            ],
          },
        }),
      });

      const result = await provider.verify({ doi: '10.1016/concern.2020' });

      const updateSignal = result.signals.find((s) => s.type === 'SIGNAL-004');
      expect(updateSignal).toBeDefined();
      expect(updateSignal!.severity).toBe('HIGH');
    });

    it('should detect metadata mismatch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          'message-type': 'work',
          message: {
            DOI: '10.1038/nature12373',
            title: ['The actual correct title'],
            'container-title': ['Science'],
            published: { 'date-parts': [[2020]] },
            publisher: 'AAAS',
          },
        }),
      });

      const result = await provider.verify({
        doi: '10.1038/nature12373',
        title: 'A completely different title',
        year: 2023,
        journal: 'Nature',
      });

      expect(result.status).toBe('MISMATCH');

      const metaSignal = result.signals.find((s) => s.type === 'SIGNAL-002');
      expect(metaSignal).toBeDefined();
      expect(metaSignal!.severity).toBe('HIGH');
    });

    it('should return ERROR when API fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.verify({ doi: '10.1038/nature12373' });

      expect(result.status).toBe('ERROR');
    });

    it('should return ERROR when response schema is invalid', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'response' }),
      });

      const result = await provider.verify({ doi: '10.1038/nature12373' });

      expect(result.status).toBe('ERROR');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API responds', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      expect(await provider.isAvailable()).toBe(true);
    });

    it('should return false when API fails', async () => {
      mockFetch.mockRejectedValue(new Error('timeout'));
      expect(await provider.isAvailable()).toBe(false);
    });
  });
});
