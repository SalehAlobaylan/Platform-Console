import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/page';

export const Route = createFileRoute('/_dashboard/')({ component: Page });
