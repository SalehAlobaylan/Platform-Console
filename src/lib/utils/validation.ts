import { z } from 'zod';

// Customer form validation schema
export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(['active', 'inactive', 'lead']).optional(),
});

// Source form validation schema
export const sourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['RSS', 'PODCAST', 'YOUTUBE', 'TWITTER', 'REDDIT', 'MANUAL']),
  feed_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  is_active: z.boolean().optional(),
  fetch_interval_minutes: z.number().min(5).max(1440).optional(),
});

// Deal form validation schema
export const dealSchema = z.object({
  name: z.string().min(1, 'Deal name is required'),
  customer_id: z.string().min(1, 'Customer is required'),
  stage: z.enum([
    'lead',
    'qualified',
    'proposal',
    'negotiation',
    'won',
    'lost',
  ]),
  amount: z.number().min(0).optional(),
  currency: z.string().default('USD'),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
export type SourceFormData = z.infer<typeof sourceSchema>;
export type DealFormData = z.infer<typeof dealSchema>;
