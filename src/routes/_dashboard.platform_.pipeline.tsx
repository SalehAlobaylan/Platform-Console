import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/pipeline/page';

export const Route = createFileRoute('/_dashboard/platform_/pipeline')({ component: Page });
