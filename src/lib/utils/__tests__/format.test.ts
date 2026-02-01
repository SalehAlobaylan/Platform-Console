import { formatDistanceToNow, format } from 'date-fns';
import {
  formatRelativeTime,
  formatDate,
  formatCurrency,
  formatNumber,
} from './format';

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(),
  format: jest.fn(),
  parseISO: jest.fn((date) => new Date(date)),
}));

describe('format utilities', () => {
  describe('formatRelativeTime', () => {
    it('should format date string to relative time', () => {
      (formatDistanceToNow as jest.Mock).mockReturnValue('2 hours ago');

      const result = formatRelativeTime('2024-01-15T12:00:00Z');

      expect(formatDistanceToNow).toHaveBeenCalledWith(
        new Date('2024-01-15T12:00:00Z'),
        { addSuffix: true }
      );
      expect(result).toBe('2 hours ago');
    });

    it('should handle Date objects', () => {
      (formatDistanceToNow as jest.Mock).mockReturnValue('1 day ago');
      const date = new Date('2024-01-14');

      const result = formatRelativeTime(date);

      expect(formatDistanceToNow).toHaveBeenCalledWith(date, {
        addSuffix: true,
      });
      expect(result).toBe('1 day ago');
    });
  });

  describe('formatDate', () => {
    it('should format date with default format', () => {
      (format as jest.Mock).mockReturnValue('Jan 15, 2024');

      const result = formatDate('2024-01-15');

      expect(format).toHaveBeenCalledWith(
        new Date('2024-01-15'),
        'MMM d, yyyy'
      );
      expect(result).toBe('Jan 15, 2024');
    });

    it('should format date with custom format', () => {
      (format as jest.Mock).mockReturnValue('15/01/2024');

      const result = formatDate('2024-01-15', 'dd/MM/yyyy');

      expect(format).toHaveBeenCalledWith(new Date('2024-01-15'), 'dd/MM/yyyy');
      expect(result).toBe('15/01/2024');
    });
  });

  describe('formatCurrency', () => {
    it('should format USD currency by default', () => {
      const result = formatCurrency(1234.56);

      expect(result).toBe('$1,234.56');
    });

    it('should format EUR currency', () => {
      const result = formatCurrency(1234.56, 'EUR');

      expect(result).toMatch(/1\.234,56/);
    });

    it('should format zero amount', () => {
      const result = formatCurrency(0);

      expect(result).toBe('$0.00');
    });

    it('should format negative amounts', () => {
      const result = formatCurrency(-100);

      expect(result).toBe('-$100.00');
    });
  });

  describe('formatNumber', () => {
    it('should format number with locale', () => {
      const result = formatNumber(1234567);

      expect(result).toBe('1,234,567');
    });

    it('should format zero', () => {
      const result = formatNumber(0);

      expect(result).toBe('0');
    });

    it('should format decimal numbers', () => {
      const result = formatNumber(1234.56);

      expect(result).toBe('1,234.56');
    });
  });
});
