import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/intelligence/analytics/page';

export const Route = createFileRoute('/_dashboard/platform_/intelligence_/analytics')({ component: Page });
