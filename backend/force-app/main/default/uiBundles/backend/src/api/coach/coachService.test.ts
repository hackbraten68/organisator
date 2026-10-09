/**
 * `Coach_Profile__c.User__c` — die Verknuepfung von Coach-Profil und Login.
 *
 * WARUM DIESER TEST EXISTIERT
 * Das Feld ist optional, und "optional" ist hier der interessante Fall: Ghaith
 * Saidani hat ein Coach-Profil, aber keinen Salesforce-Account. Ein leeres Feld
 * heisst deshalb "kein Login bekannt" — es ist kein kaputtes Profil und kein
 * Anlass, den Coach zu ueberspringen. Ohne Test wuerde das Mapping stillschweigend
 * zu `undefined`, und die Frage "Coach ohne Account" faellt in einem UI nicht
 * mehr auf, sondern nur noch beim Zuordnen von Hand.
 *
 * Zusaetzlich abgesichert: das Feld ist nicht `Contact.Freigeschaltet__c` und nicht
 * `Appointment__c.Coach__c`. Es beantwortet "welcher Login gehoert zu diesem
 * Profil", nicht "wer ist als Coach buchbar" — das bleibt `listAssignableUsers`.
 */

import { describe, expect, it, vi } from 'vitest';
import { executeGraphQL } from '../graphqlClient';
import LIST_COACHES from './query/ListCoaches.graphql?raw';
import { listCoaches } from './coachService';

vi.mock('../graphqlClient', () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQL);

const value = (v: unknown) => ({ value: v });

const node = (id: string, name: string, userId: string | null = null) => ({
  Id: id,
  Name: value(name),
  User__c: value(userId),
});

function coachesResponse(nodes: ReturnType<typeof node>[]) {
  return {
    uiapi: {
      query: {
        Coach_Profile__c: { edges: nodes.map(n => ({ node: n })) },
      },
    },
  };
}

describe('listCoaches', () => {
  it('reicht die User-Id des Coach-Profils durch', async () => {
    mockedExecute.mockResolvedValue(
      coachesResponse([node('a0p9', 'Sandra Krüger', '0056700000DbU5CAAV')]),
    );

    const [coach] = await listCoaches();

    expect(coach).toMatchObject({
      id: 'a0p9',
      name: 'Sandra Krüger',
      userId: '0056700000DbU5CAAV',
    });
  });

  it('meldet ein Profil ohne Login als "kein Login", nicht als Fehler', async () => {
    // Ghaith Saidani: Profil vorhanden, User__c leer.
    mockedExecute.mockResolvedValue(
      coachesResponse([
        node('a0p9a', 'Frank Blum', '0056700000DbWBqAAN'),
        node('a0p9b', 'Ghaith Saidani', null),
      ]),
    );

    const coaches = await listCoaches();

    expect(coaches).toHaveLength(2);
    expect(coaches.map(c => c.userId)).toEqual([
      '0056700000DbWBqAAN',
      undefined,
    ]);
    // Das Profil bleibt nutzbar — es ist der Name, der zaehlt.
    expect(coaches[1].name).toBe('Ghaith Saidani');
  });

  it('behandelt ein komplett fehlendes Feld wie ein leeres', async () => {
    // Der GraphQL-Server liefert bei @optional auch mal gar keinen Schluessel.
    mockedExecute.mockResolvedValue({
      uiapi: {
        query: {
          Coach_Profile__c: {
            edges: [
              { node: { Id: 'a0p9c', Name: value('Sam Dillenburg') } },
            ],
          },
        },
      },
    });

    const [coach] = await listCoaches();

    expect(coach.userId).toBeUndefined();
    expect(coach.name).toBe('Sam Dillenburg');
  });

  it('fragt User__c auch wirklich ab', async () => {
    // Ohne den Selektor liefert die Query das Feld nie, und der Test oben
    // waere gruen gegen eine Implementierung, die nichts bekommt.
    expect(LIST_COACHES).toContain('User__c @optional');
  });

  it('liefert eine leere Liste, wenn die Query keine Kanten zurueckgibt', async () => {
    mockedExecute.mockResolvedValue({ uiapi: { query: { Coach_Profile__c: null } } });

    await expect(listCoaches()).resolves.toEqual([]);
  });
});