import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/operations/page';

export const Route = createFileRoute('/_dashboard/platform_/operations')({ component: Page });
