import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/database-migrations/page';

export const Route = createFileRoute('/_dashboard/platform_/database-migrations')({ component: Page });
