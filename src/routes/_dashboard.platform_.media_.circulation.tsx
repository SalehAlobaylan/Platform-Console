import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/media/circulation/page';

export const Route = createFileRoute('/_dashboard/platform_/media_/circulation')({ component: Page });
