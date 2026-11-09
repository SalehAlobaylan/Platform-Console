import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/workload/page';

export const Route = createFileRoute('/_dashboard/platform_/workload')({ component: Page });
