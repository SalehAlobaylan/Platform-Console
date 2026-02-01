import type { Tag } from '@/types/crm';

interface TagChipProps {
    tag: Tag;
    onRemove?: () => void;
}

export function TagChip({ tag, onRemove }: TagChipProps) {
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
            style={{
                backgroundColor: tag.color,
                color: '#ffffff',
            }}
        >
            {tag.name}
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="hover:bg-black/10 rounded-full p-0.5"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </span>
    );
}
