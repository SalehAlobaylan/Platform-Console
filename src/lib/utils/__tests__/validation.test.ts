import { customerSchema, sourceSchema, dealSchema } from '../validation';

describe('validation schemas', () => {
  describe('customerSchema', () => {
    it('should validate valid customer data', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        company: 'Acme Inc',
        status: 'active' as const,
      };

      const result = customerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        email: 'john@example.com',
      };

      const result = customerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      const result = customerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should allow optional email as empty string', () => {
      const data = {
        name: 'John Doe',
        email: '',
      };

      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should allow partial customer data', () => {
      const partialData = {
        name: 'John Doe',
      };

      const result = customerSchema.safeParse(partialData);
      expect(result.success).toBe(true);
    });
  });

  describe('sourceSchema', () => {
    it('should validate valid source data', () => {
      const validData = {
        name: 'Tech Blog RSS',
        type: 'RSS' as const,
        feed_url: 'https://example.com/feed',
        is_active: true,
        fetch_interval_minutes: 60,
      };

      const result = sourceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const invalidData = {
        name: 'Tech Blog',
        type: 'RSS' as const,
        feed_url: 'not-a-url',
      };

      const result = sourceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should allow empty URL as optional', () => {
      const data = {
        name: 'Manual Source',
        type: 'MANUAL' as const,
        feed_url: '',
      };

      const result = sourceSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid source type', () => {
      const invalidData = {
        name: 'Invalid Source',
        type: 'INVALID',
      };

      const result = sourceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('dealSchema', () => {
    it('should validate valid deal data', () => {
      const validData = {
        name: 'Enterprise License',
        customer_id: 'cust-123',
        stage: 'proposal' as const,
        amount: 50000,
        currency: 'USD',
      };

      const result = dealSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty customer_id', () => {
      const invalidData = {
        name: 'Deal Name',
        customer_id: '',
        stage: 'lead' as const,
      };

      const result = dealSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative amount', () => {
      const invalidData = {
        name: 'Deal Name',
        customer_id: 'cust-123',
        stage: 'lead' as const,
        amount: -100,
      };

      const result = dealSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should allow zero amount', () => {
      const data = {
        name: 'Deal Name',
        customer_id: 'cust-123',
        stage: 'lead' as const,
        amount: 0,
      };

      const result = dealSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
