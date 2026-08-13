import { DemoCacheService } from './demo-cache.service';

describe('DemoCacheService', () => {
  let service: DemoCacheService;

  beforeEach(() => {
    service = new DemoCacheService();
  });

  describe('hasCachedResults', () => {
    it('should return true for Case A - normal paper', () => {
      expect(service.hasCachedResults('10.1038/nature12373')).toBe(true);
    });

    it('should return true for Case B - retracted paper', () => {
      expect(service.hasCachedResults('10.1016/s0140-6736(98)01234-5')).toBe(true);
    });

    it('should return true for Case C - metadata inconsistency', () => {
      expect(service.hasCachedResults('10.1126/science.abc1234')).toBe(true);
    });

    it('should return false for unknown DOI', () => {
      expect(service.hasCachedResults('10.9999/unknown')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(service.hasCachedResults('10.1038/NATURE12373')).toBe(true);
    });
  });

  describe('getCachedResults', () => {
    it('should return results for Case A with VERIFIED status', () => {
      const results = service.getCachedResults('10.1038/nature12373');
      expect(results).not.toBeNull();
      expect(results!.length).toBe(3); // crossref, openalex, pubmed
      expect(results![0].status).toBe('VERIFIED');
    });

    it('should return results for Case B with retraction signals', () => {
      const results = service.getCachedResults('10.1016/s0140-6736(98)01234-5');
      expect(results).not.toBeNull();

      // Should have CRITICAL retraction signals
      const allSignals = results!.flatMap((r) => r.signals);
      const retractionSignals = allSignals.filter((s) => s.type === 'SIGNAL-003');
      expect(retractionSignals.length).toBeGreaterThanOrEqual(1);
      expect(retractionSignals[0].severity).toBe('CRITICAL');
    });

    it('should return results for Case C with metadata mismatch', () => {
      const results = service.getCachedResults('10.1126/science.abc1234');
      expect(results).not.toBeNull();

      const allSignals = results!.flatMap((r) => r.signals);
      const mismatchSignals = allSignals.filter((s) => s.type === 'SIGNAL-002' && s.severity === 'HIGH');
      expect(mismatchSignals.length).toBeGreaterThanOrEqual(1);
    });

    it('should return null for unknown DOI', () => {
      expect(service.getCachedResults('10.9999/unknown')).toBeNull();
    });
  });
});
