import { describe, expect, it } from 'vitest';
import { participantDisplayEmail, participantDisplayName } from './participantDisplay';
import type { Participant } from '@/types/participant';

const participant = (overrides: Partial<Participant> = {}): Participant => ({
  id: 'a059-1',
  name: 'Snapshot Name',
  status: 'Onboarding',
  email: 'snapshot@example.com',
  ...overrides,
});

/**
 * The precedence "contact first, snapshot as fallback" exists in exactly one
 * place. These tests are what stops that rule from quietly changing: a
 * component that reads participant.name directly would look like it works and
 * quietly show the wrong person.
 */
describe('participantDisplayName', () => {
  it('prefers the contact name', () => {
    const result = participantDisplayName(
      participant({ contact: { id: '003a', name: 'Aylin Yilmaz' } }),
    );
    expect(result).toBe('Aylin Yilmaz');
  });

  it('falls back to the participant name when the contact has no name', () => {
    const result = participantDisplayName(participant({ contact: { id: '003a' } }));
    expect(result).toBe('Snapshot Name');
  });

  it('falls back when there is no contact at all', () => {
    expect(participantDisplayName(participant())).toBe('Snapshot Name');
  });

  it('treats a blank contact name as absent', () => {
    const result = participantDisplayName(
      participant({ contact: { id: '003a', name: '   ' } }),
    );
    expect(result).toBe('Snapshot Name');
  });
});

describe('participantDisplayEmail', () => {
  it('prefers the contact email', () => {
    const result = participantDisplayEmail(
      participant({ contact: { id: '003a', email: 'aylin@example.com' } }),
    );
    expect(result).toBe('aylin@example.com');
  });

  it('falls back to the participant snapshot', () => {
    expect(participantDisplayEmail(participant({ contact: { id: '003a' } }))).toBe(
      'snapshot@example.com',
    );
  });

  it('falls back when there is no contact at all', () => {
    expect(participantDisplayEmail(participant())).toBe('snapshot@example.com');
  });

  it('returns undefined when neither side has an address', () => {
    const result = participantDisplayEmail(
      participant({ email: undefined, contact: { id: '003a' } }),
    );
    expect(result).toBeUndefined();
  });
});
