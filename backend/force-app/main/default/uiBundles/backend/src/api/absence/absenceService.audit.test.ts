import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAbsence,
  updateAbsence,
  approveAbsence,
  rejectAbsence,
  cancelAbsence,
  uploadAbsenceDocument,
} from './absenceService';
import { auditService } from '@/api/audit/auditService';
import { getAuditActor } from '@/api/audit/actorContext';

vi.mock('@/api/graphqlClient', () => ({
  executeGraphQL: vi.fn(),
}));

vi.mock('@/api/audit/auditService', () => ({
  auditService: {
    record: vi.fn().mockResolvedValue({ id: 'audit-1' }),
  },
  generateUUID: vi.fn().mockReturnValue('test-correlation-id'),
}));

vi.mock('@/api/audit/actorContext', () => ({
  getAuditActor: vi.fn(),
}));

import { executeGraphQL } from '@/api/graphqlClient';

/**
 * Routed GraphQL mock: keyed by operation name instead of call order, so a
 * service that reads before (or after) a mutation stays testable.
 */
const ABSENCE_NODE = { Id: 'abs-1', Participant__c: { value: 'p-1' } };

function route(overrides: Record<string, unknown> = {}) {
  vi.mocked(executeGraphQL).mockImplementation(async (document: string) => {
    const name = Object.keys(overrides).find(op => document.includes(op));
    if (name) return overrides[name];
    if (document.includes('GetAbsence')) {
      return {
        uiapi: { query: { Absence__c: { edges: [{ node: ABSENCE_NODE }] } } },
      };
    }
    return {};
  });
}

describe('absenceService audit integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuditActor).mockReturnValue({
      id: 'user-1',
      type: 'staff',
      displayName: 'Test User',
    });
  });

  describe('createAbsence', () => {
    it('records absence.reported when absence is created', async () => {
      route({
        CreateAbsence: {
          uiapi: { Absence__cCreate: { Record: { Id: 'abs-1' } } },
        },
      });

      const id = await createAbsence({
        participantId: 'p-1',
        type: 'Krank',
        startDate: '2026-09-28',
        endDate: '2026-09-30',
        reason: 'Flu',
      });

      expect(id).toBe('abs-1');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'absence.reported',
          domain: 'absence',
          action: 'submitted',
          subjectId: 'abs-1',
          participantId: 'p-1',
        })
      );
    });

    it('does not record an audit event when creation fails', async () => {
      route({
        CreateAbsence: { uiapi: { Absence__cCreate: { Record: null } } },
      });

      const id = await createAbsence({
        participantId: 'p-1',
        type: 'Krank',
        startDate: '2026-09-28',
        endDate: '2026-09-30',
      });

      expect(id).toBe('');
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe('updateAbsence', () => {
    it('records absence.updated with the participant resolved from the record', async () => {
      route();

      await updateAbsence('abs-1', { type: 'Urlaub' });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'absence.updated',
          domain: 'absence',
          action: 'updated',
          subjectId: 'abs-1',
          participantId: 'p-1',
        })
      );
    });

    it('does not record an audit event when no field is patched', async () => {
      route();

      await updateAbsence('abs-1', {});

      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe('approveAbsence', () => {
    it('records absence.approved with the participant resolved from the record', async () => {
      route();

      await approveAbsence('abs-1');

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'absence.approved',
          domain: 'absence',
          action: 'approved',
          subjectId: 'abs-1',
          participantId: 'p-1',
        })
      );
    });
  });

  describe('rejectAbsence', () => {
    it('records absence.rejected with the participant resolved from the record', async () => {
      route();

      await rejectAbsence('abs-1', 'Not enough notice');

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'absence.rejected',
          domain: 'absence',
          action: 'rejected',
          subjectId: 'abs-1',
          participantId: 'p-1',
        })
      );
    });

    it('keeps the coach comment out of the event reason field', async () => {
      route();

      await rejectAbsence('abs-1', 'Not enough notice');

      const input = vi.mocked(auditService.record).mock.calls[0][0];
      expect(input.reason).toBe('Abwesenheit abgelehnt');
    });
  });

  describe('cancelAbsence', () => {
    it('records absence.cancelled with the participant resolved from the record', async () => {
      route();

      await cancelAbsence('abs-1');

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'absence.cancelled',
          domain: 'absence',
          action: 'cancelled',
          subjectId: 'abs-1',
          participantId: 'p-1',
        })
      );
    });
  });

  describe('uploadAbsenceDocument', () => {
    it('records absence.document_added with the participant resolved from the record', async () => {
      route({
        CreateContentVersion: {
          uiapi: { ContentVersionCreate: { Record: { Id: 'cv-1' } } },
        },
        GetDocLink: {
          uiapi: {
            query: {
              ContentVersion: {
                edges: [{ node: { ContentDocumentId: { value: 'cd-1' } } }],
              },
            },
          },
        },
      });

      await uploadAbsenceDocument(
        'abs-1',
        {
          title: 'note.pdf',
          pathOnClient: 'note.pdf',
          versionData: 'YmFzZTY0',
        },
        'user-1'
      );

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'absence.document_added',
          domain: 'absence',
          action: 'document_added',
          subjectId: 'abs-1',
          participantId: 'p-1',
        })
      );
    });

    it('throws and records nothing when the content version is not created', async () => {
      route({
        CreateContentVersion: {
          uiapi: { ContentVersionCreate: { Record: null } },
        },
      });

      await expect(
        uploadAbsenceDocument(
          'abs-1',
          {
            title: 'note.pdf',
            pathOnClient: 'note.pdf',
            versionData: 'YmFzZTY0',
          },
          'user-1'
        )
      ).rejects.toThrow('Failed to create ContentVersion');

      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe('actor resolution', () => {
    it('stamps the session actor on the event', async () => {
      route({
        CreateAbsence: {
          uiapi: { Absence__cCreate: { Record: { Id: 'abs-1' } } },
        },
      });

      await createAbsence({
        participantId: 'p-1',
        type: 'Krank',
        startDate: '2026-09-28',
        endDate: '2026-09-30',
      });

      expect(getAuditActor).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'staff',
          actorId: 'user-1',
          actorDisplayNameSnapshot: 'Test User',
        })
      );
    });
  });
});
