import { parseExplicitPodsResetIDs, podsResetApprovalPhrase } from '../policy';

describe('Pods reset operator safety helpers', () => {
  it('parses only explicit UUIDs and detects duplicates without silently normalizing the selection', () => {
    const id = 'A3D6C258-8EB8-4F03-96A1-4EE4C6352F00';
    expect(
      parseExplicitPodsResetIDs(`${id}\n${id.toLowerCase()}\nnot-an-id`)
    ).toEqual({
      ids: [id.toLowerCase()],
      duplicates: [id.toLowerCase()],
      invalid: ['not-an-id'],
    });
  });

  it('binds irreversible confirmation to selected count and full manifest hash prefix', () => {
    expect(podsResetApprovalPhrase('abcdef1234567890'.padEnd(64, '0'), 3)).toBe(
      'RESET PODS 3 ABCDEF12 IRREVERSIBLE'
    );
    expect(podsResetApprovalPhrase('invalid', 3)).toBe('');
  });
});
