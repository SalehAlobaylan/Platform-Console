import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/media/redundancy/page';

export const Route = createFileRoute('/_dashboard/platform_/media_/redundancy')({ component: Page });
