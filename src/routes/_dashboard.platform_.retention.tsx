import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/retention/page';

export const Route = createFileRoute('/_dashboard/platform_/retention')({ component: Page });
