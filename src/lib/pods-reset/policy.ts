export interface ExplicitIDSelection {
  ids: string[];
  duplicates: string[];
  invalid: string[];
}

export function parseExplicitPodsResetIDs(value: string): ExplicitIDSelection {
  const tokens = value
    .split(/[\s,;]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  const ids: string[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        normalized
      )
    ) {
      invalid.push(token);
      continue;
    }
    if (seen.has(normalized)) {
      duplicates.push(token);
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return { ids, duplicates, invalid };
}

export function podsResetApprovalPhrase(
  manifestHash: string,
  selectedCount: number
): string {
  if (
    !/^[0-9a-f]{64}$/i.test(manifestHash) ||
    !Number.isInteger(selectedCount) ||
    selectedCount < 1
  )
    return '';
  return `RESET PODS ${selectedCount} ${manifestHash.slice(0, 8).toUpperCase()} IRREVERSIBLE`;
}
