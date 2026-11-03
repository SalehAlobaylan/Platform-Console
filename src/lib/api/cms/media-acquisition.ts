import { cmsClient } from '@/lib/api/client';
import type { MediaAcquisitionMode } from '@/types/platform/source';

export interface MediaAcquisitionConfig {
    environment?: string;
    can_manage?: boolean;
    tenant_id: string;
    default_mode: MediaAcquisitionMode;
    pods_source_run_item_limit: number;
    updated_by: string;
    created_at: string;
    updated_at: string;
}

export interface MediaAcquisitionResult {
    content_item_id: string;
    request_id?: string;
    state?: string;
    disposition?: string;
    error?: string;
}

interface Envelope<T> {
    data: T;
    message: string;
}

export const getMediaAcquisitionConfig = () =>
    cmsClient.get<MediaAcquisitionConfig>('/admin/media-acquisition/config');

export interface MediaAcquisitionConfigUpdate {
    expected_updated_at?: string;
    default_mode?: MediaAcquisitionMode;
    pods_source_run_item_limit?: number;
}

export const updateMediaAcquisitionConfig = (update: MediaAcquisitionConfigUpdate) =>
    cmsClient.patch<MediaAcquisitionConfig>('/admin/media-acquisition/config', {
        ...update,
    });

export const requestMediaAcquisition = async (id: string) => {
    const response = await cmsClient.post<Envelope<MediaAcquisitionResult>>(
        `/admin/media-acquisition/items/${id}/request`,
        {}
    );
    return response.data;
};

export const bulkRequestMediaAcquisition = async (contentIds: string[]) => {
    const response = await cmsClient.post<Envelope<MediaAcquisitionResult[]>>(
        '/admin/media-acquisition/requests',
        { content_ids: contentIds }
    );
    return response.data;
};
