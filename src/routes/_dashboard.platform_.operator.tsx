import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/operator/page';

export const Route = createFileRoute('/_dashboard/platform_/operator')({ component: Page });
