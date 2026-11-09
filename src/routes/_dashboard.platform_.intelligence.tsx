import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/intelligence/page';

export const Route = createFileRoute('/_dashboard/platform_/intelligence')({ component: Page });
