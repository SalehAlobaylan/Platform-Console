import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/system-health/page';

export const Route = createFileRoute('/_dashboard/platform_/system-health')({ component: Page });
