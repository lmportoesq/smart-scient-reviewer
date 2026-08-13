import { DoiExtractorService } from './doi-extractor.service';

describe('DoiExtractorService', () => {
  let service: DoiExtractorService;

  beforeEach(() => {
    service = new DoiExtractorService();
  });

  describe('extractDoi', () => {
    it('should extract a standard DOI', () => {
      const text = 'This paper has DOI 10.1038/nature12373 available';
      expect(service.extractDoi(text)).toBe('10.1038/nature12373');
    });

    it('should extract DOI with complex suffix', () => {
      const text = 'DOI: 10.1016/j.cell.2020.01.001';
      expect(service.extractDoi(text)).toBe('10.1016/j.cell.2020.01.001');
    });

    it('should clean trailing punctuation from DOI', () => {
      const text = 'See reference (10.1038/nature12373).';
      expect(service.extractDoi(text)).toBe('10.1038/nature12373');
    });

    it('should return null when no DOI found', () => {
      const text = 'This text has no digital object identifier.';
      expect(service.extractDoi(text)).toBeNull();
    });

    it('should handle DOI in URL format', () => {
      const text = 'https://doi.org/10.1126/science.1234567';
      expect(service.extractDoi(text)).toBe('10.1126/science.1234567');
    });
  });

  describe('extractPmid', () => {
    it('should extract PMID with colon format', () => {
      const text = 'PMID: 12345678';
      expect(service.extractPmid(text)).toBe('12345678');
    });

    it('should extract PMID from PubMed URL', () => {
      const text = 'https://pubmed.ncbi.nlm.nih.gov/12345678';
      expect(service.extractPmid(text)).toBe('12345678');
    });

    it('should return null when no PMID found', () => {
      const text = 'No pubmed identifier in this text.';
      expect(service.extractPmid(text)).toBeNull();
    });
  });

  describe('extractAllDois', () => {
    it('should extract multiple DOIs', () => {
      const text = `
        Reference 1: 10.1038/nature12373
        Reference 2: 10.1016/j.cell.2020.01.001
      `;
      const dois = service.extractAllDois(text);
      expect(dois).toHaveLength(2);
      expect(dois).toContain('10.1038/nature12373');
      expect(dois).toContain('10.1016/j.cell.2020.01.001');
    });

    it('should deduplicate DOIs', () => {
      const text = '10.1038/nature12373 cited again 10.1038/nature12373';
      const dois = service.extractAllDois(text);
      expect(dois).toHaveLength(1);
    });
  });
});
