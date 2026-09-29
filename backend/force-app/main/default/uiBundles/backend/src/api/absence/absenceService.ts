import { executeGraphQL } from '@/api/graphqlClient';
import type {
  Absence,
  AbsenceInput,
  AbsencePatch,
  AbsenceFilters,
  AbsenceDocument,
} from '@/types/absence';
import { getAuditActor } from '@/api/audit/actorContext';
import {
  recordAbsenceReported,
  recordAbsenceUpdated,
  recordAbsenceApproved,
  recordAbsenceRejected,
  recordAbsenceCancelled,
  recordAbsenceDocumentAdded,
} from '@/api/audit/absenceAuditIntegration';
import { generateUUID } from '@/api/audit/auditService';

export type {
  Absence,
  AbsenceInput,
  AbsencePatch,
  AbsenceFilters,
  AbsenceDocument,
};

import GET_ABSENCE_RAW from '@/api/absence/query/GetAbsence.graphql?raw';
import LIST_ABSENCES_RAW from '@/api/absence/query/ListAbsences.graphql?raw';
import GET_ABSENCES_BY_PARTICIPANT_RAW from '@/api/absence/query/GetAbsencesByParticipant.graphql?raw';
import CREATE_ABSENCE_RAW from '@/api/absence/query/CreateAbsence.graphql?raw';
import UPDATE_ABSENCE_RAW from '@/api/absence/query/UpdateAbsence.graphql?raw';
import APPROVE_ABSENCE_RAW from '@/api/absence/query/ApproveAbsence.graphql?raw';
import REJECT_ABSENCE_RAW from '@/api/absence/query/RejectAbsence.graphql?raw';
import CANCEL_ABSENCE_RAW from '@/api/absence/query/CancelAbsence.graphql?raw';
import GET_ABSENCE_DOCUMENTS_RAW from '@/api/absence/query/GetAbsenceDocuments.graphql?raw';
import CREATE_CONTENT_VERSION_RAW from '@/api/absence/query/CreateContentVersion.graphql?raw';
import GET_DOC_LINK_RAW from '@/api/absence/query/GetDocLink.graphql?raw';

type ScalarValue<T = string> = { value?: T | null } | null | undefined;

interface AbsenceNode {
  Id: string;
  Name?: ScalarValue<string>;
  Participant__c?: ScalarValue<string>;
  Type__c?: ScalarValue<string>;
  Status__c?: ScalarValue<string>;
  StartDate__c?: ScalarValue<string>;
  EndDate__c?: ScalarValue<string>;
  Reason__c?: ScalarValue<string>;
  ApprovedBy__c?: ScalarValue<string>;
  ApprovedAt__c?: ScalarValue<string>;
  RejectedBy__c?: ScalarValue<string>;
  RejectedAt__c?: ScalarValue<string>;
  CoachComment__c?: ScalarValue<string>;
  CreatedDate?: ScalarValue<string>;
  LastModifiedDate?: ScalarValue<string>;
  Participant__r?: { Name?: ScalarValue<string> } | null;
  ApprovedBy__r?: { Name?: ScalarValue<string> } | null;
  RejectedBy__r?: { Name?: ScalarValue<string> } | null;
}

interface GetAbsenceResponse {
  uiapi?: {
    query?: {
      Absence__c?: {
        edges?: Array<{ node?: AbsenceNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

interface ListAbsencesResponse {
  uiapi?: {
    query?: {
      Absence__c?: {
        edges?: Array<{ node?: AbsenceNode | null } | null> | null;
        pageInfo?: { hasNextPage?: boolean; endCursor?: string } | null;
      } | null;
    } | null;
  } | null;
}

interface GetAbsencesByParticipantResponse {
  uiapi?: {
    query?: {
      Absence__c?: {
        edges?: Array<{ node?: AbsenceNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

interface MutationResponse {
  uiapi?: Record<string, { Record?: { Id?: string } | null } | null>;
}

/**
 * The UI API wraps every optional field in an `*Value` type, so these arrive
 * as `{ value }` rather than as bare scalars. `Id` is the exception: it is a
 * plain ID and needs no wrapper.
 */
type Wrapped<T> = { value?: T | null } | null | undefined;

interface ContentDocumentLinkNode {
  Id: string;
  ContentDocumentId?: Wrapped<string>;
  LinkedEntityId?: Wrapped<string>;
  ShareType?: Wrapped<string>;
  Visibility?: Wrapped<string>;
  ContentDocument?: {
    Id: string;
    Title?: Wrapped<string>;
    FileType?: Wrapped<string>;
    LatestPublishedVersionId?: Wrapped<string>;
    ContentVersions: {
      edges: Array<{
        node: {
          Id: string;
          Title?: Wrapped<string>;
          ContentSize?: Wrapped<number>;
          FileExtension?: Wrapped<string>;
          VersionData?: Wrapped<string>;
        };
      }>;
    };
  } | null;
}

interface GetAbsenceDocumentsResponse {
  uiapi?: {
    query?: {
      ContentDocumentLink?: {
        edges?: Array<{ node?: ContentDocumentLinkNode }> | null;
      } | null;
    } | null;
  } | null;
}

interface ContentVersionNode {
  ContentDocumentId?: Wrapped<string>;
}

interface GetDocLinkResponse {
  uiapi?: {
    query?: {
      ContentVersion?: {
        edges?: Array<{ node?: ContentVersionNode }> | null;
      } | null;
    } | null;
  } | null;
}

function mapGqlToAbsence(node: any): Absence {
  return {
    id: node.Id,
    name: node.Name?.value || '',
    participantId: node.Participant__c?.value || '',
    participantName: node.Participant__r?.Name?.value,
    type: node.Type__c?.value as Absence['type'],
    status: node.Status__c?.value as Absence['status'],
    startDate: node.StartDate__c?.value || '',
    endDate: node.EndDate__c?.value || '',
    reason: node.Reason__c?.value,
    approvedById: node.ApprovedBy__c?.value,
    approvedByName: node.ApprovedBy__r?.Name?.value,
    approvedAt: node.ApprovedAt__c?.value,
    rejectedById: node.RejectedBy__c?.value,
    rejectedByName: node.RejectedBy__r?.Name?.value,
    rejectedAt: node.RejectedAt__c?.value,
    coachComment: node.CoachComment__c?.value,
    createdAt: node.CreatedDate?.value || '',
    updatedAt: node.LastModifiedDate?.value || '',
  };
}

export async function getAbsence(id: string): Promise<Absence | null> {
  const response = await executeGraphQL<GetAbsenceResponse, { id: string }>(
    GET_ABSENCE_RAW,
    { id }
  );
  const node = response?.uiapi?.query?.Absence__c?.edges?.[0]?.node;
  return node ? mapGqlToAbsence(node) : null;
}

export async function listAbsences(
  filters: AbsenceFilters = {},
  first = 50,
  after?: string
): Promise<{ absences: Absence[]; hasNextPage: boolean; endCursor?: string }> {
  const vars = {
    participantId: filters.participantId,
    status: filters.status,
    type: filters.type,
    startDateFrom: filters.startDateFrom,
    startDateTo: filters.startDateTo,
    first,
    after,
  };
  const response = await executeGraphQL<ListAbsencesResponse, typeof vars>(
    LIST_ABSENCES_RAW,
    vars
  );
  const edges = response?.uiapi?.query?.Absence__c?.edges || [];
  const pageInfo = response?.uiapi?.query?.Absence__c?.pageInfo;

  return {
    absences: edges.map((e: any) => mapGqlToAbsence(e.node)),
    hasNextPage: pageInfo?.hasNextPage || false,
    endCursor: pageInfo?.endCursor,
  };
}

export async function getAbsencesByParticipant(
  participantId: string,
  first = 50
): Promise<Absence[]> {
  const response = await executeGraphQL<
    GetAbsencesByParticipantResponse,
    { participantId: string; first: number }
  >(GET_ABSENCES_BY_PARTICIPANT_RAW, { participantId, first });
  const edges = response?.uiapi?.query?.Absence__c?.edges || [];
  return edges.map((e: any) => mapGqlToAbsence(e.node));
}

export async function createAbsence(input: AbsenceInput): Promise<string> {
  const response = await executeGraphQL<
    MutationResponse,
    {
      participantId: string;
      type: string;
      status: string;
      startDate: string;
      endDate: string;
    }
  >(CREATE_ABSENCE_RAW, {
    participantId: input.participantId,
    type: input.type,
    status: input.status || 'Submitted',
    startDate: input.startDate,
    endDate: input.endDate,
  });
  const id = response?.uiapi?.Absence__cCreate?.Record?.Id ?? '';
  if (id) {
    const actor = getAuditActor();
    await recordAbsenceReported({
      absence: {
        id,
        participantId: input.participantId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
      },
      actor,
      correlationId: generateUUID(),
    });
  }
  return id;
}

export async function updateAbsence(
  id: string,
  patch: AbsencePatch
): Promise<void> {
  const vars: Record<string, any> = { id };
  if (patch.type !== undefined) vars.type = patch.type;
  if (patch.status !== undefined) vars.status = patch.status;
  if (patch.startDate !== undefined) vars.startDate = patch.startDate;
  if (patch.endDate !== undefined) vars.endDate = patch.endDate;
  if (patch.reason !== undefined) vars.reason = patch.reason;
  if (patch.coachComment !== undefined) vars.coachComment = patch.coachComment;

  const existing = await getAbsence(id);

  await executeGraphQL<MutationResponse, Record<string, any>>(
    UPDATE_ABSENCE_RAW,
    vars
  );

  const changes: Array<{
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
    redacted: boolean;
  }> = [];
  if (patch.type !== undefined)
    changes.push({ field: 'Type__c', newValue: patch.type, redacted: false });
  if (patch.status !== undefined)
    changes.push({
      field: 'Status__c',
      newValue: patch.status,
      redacted: false,
    });
  if (patch.startDate !== undefined)
    changes.push({
      field: 'StartDate__c',
      newValue: patch.startDate,
      redacted: false,
    });
  if (patch.endDate !== undefined)
    changes.push({
      field: 'EndDate__c',
      newValue: patch.endDate,
      redacted: false,
    });
  if (patch.reason !== undefined)
    changes.push({
      field: 'Reason__c',
      newValue: patch.reason,
      redacted: true,
    });
  if (patch.coachComment !== undefined)
    changes.push({
      field: 'CoachComment__c',
      newValue: patch.coachComment,
      redacted: false,
    });

  if (changes.length > 0) {
    const actor = getAuditActor();
    await recordAbsenceUpdated({
      absence: {
        id,
        participantId: existing?.participantId ?? '',
        type: patch.type ?? '',
        status: patch.status ?? '',
        startDate: patch.startDate ?? '',
        endDate: patch.endDate ?? '',
        reason: patch.reason,
      },
      changes,
      actor,
      correlationId: generateUUID(),
    });
  }
}

export async function approveAbsence(id: string): Promise<void> {
  const existing = await getAbsence(id);
  await executeGraphQL<MutationResponse, { id: string }>(APPROVE_ABSENCE_RAW, {
    id,
  });
  const actor = getAuditActor();
  await recordAbsenceApproved({
    absence: {
      id,
      participantId: existing?.participantId ?? '',
      type: '',
      startDate: '',
      endDate: '',
    },
    approver: actor,
    correlationId: generateUUID(),
  });
}

export async function rejectAbsence(
  id: string,
  coachComment: string
): Promise<void> {
  const existing = await getAbsence(id);
  await executeGraphQL<MutationResponse, { id: string; coachComment: string }>(
    REJECT_ABSENCE_RAW,
    { id, coachComment }
  );
  const actor = getAuditActor();
  await recordAbsenceRejected({
    absence: {
      id,
      participantId: existing?.participantId ?? '',
      type: '',
      startDate: '',
      endDate: '',
    },
    rejector: actor,
    reason: coachComment,
    correlationId: generateUUID(),
  });
}

export async function cancelAbsence(id: string): Promise<void> {
  const existing = await getAbsence(id);
  await executeGraphQL<MutationResponse, { id: string }>(CANCEL_ABSENCE_RAW, {
    id,
  });
  const actor = getAuditActor();
  await recordAbsenceCancelled({
    absence: { id, participantId: existing?.participantId ?? '', type: '' },
    actor,
    correlationId: generateUUID(),
  });
}

export async function getAbsenceDocuments(
  absenceId: string
): Promise<AbsenceDocument[]> {
  const response = await executeGraphQL<
    GetAbsenceDocumentsResponse,
    { absenceId: string }
  >(GET_ABSENCE_DOCUMENTS_RAW, { absenceId });

  const edges = response?.uiapi?.query?.ContentDocumentLink?.edges ?? [];
  return edges
    .map(edge => edge?.node)
    .filter((link): link is ContentDocumentLinkNode => link != null)
    .map(link => {
      const doc = link.ContentDocument;
      const version = doc?.ContentVersions?.edges?.[0]?.node;
      return {
        id: link.Id,
        absenceId: link.LinkedEntityId?.value ?? absenceId,
        contentDocumentId: link.ContentDocumentId?.value ?? '',
        fileName: doc?.Title?.value ?? '',
        fileSize: version?.ContentSize?.value ?? 0,
        fileType: doc?.FileType?.value ?? '',
        uploadedById: '',
        uploadedByName: '',
        uploadedAt: '',
      };
    });
}

export async function uploadAbsenceDocument(
  absenceId: string,
  file: { title: string; pathOnClient: string; versionData: string },
  _uploadedById: string
): Promise<{ contentDocumentId: string; contentVersionId: string }> {
  const response = await executeGraphQL<
    MutationResponse,
    {
      title: string;
      pathOnClient: string;
      versionData: string;
      firstPublishLocationId: string;
    }
  >(CREATE_CONTENT_VERSION_RAW, {
    title: file.title,
    pathOnClient: file.pathOnClient,
    versionData: file.versionData,
    firstPublishLocationId: absenceId,
  });

  const contentVersionId = response?.uiapi?.ContentVersionCreate?.Record?.Id;
  if (!contentVersionId) {
    throw new Error('Failed to create ContentVersion');
  }

  const docLinkResponse = await executeGraphQL<
    GetDocLinkResponse,
    { cvId: string }
  >(GET_DOC_LINK_RAW, { cvId: contentVersionId });

  const contentDocumentId =
    docLinkResponse?.uiapi?.query?.ContentVersion?.edges?.[0]?.node
      ?.ContentDocumentId?.value;

  if (contentDocumentId) {
    const existing = await getAbsence(absenceId);
    const actor = getAuditActor();
    await recordAbsenceDocumentAdded({
      absence: { id: absenceId, participantId: existing?.participantId ?? '' },
      document: {
        id: contentVersionId,
        fileName: file.title,
        fileSize: 0,
        contentDocumentId,
      },
      actor,
      correlationId: generateUUID(),
    });
  }

  return {
    contentDocumentId: contentDocumentId ?? '',
    contentVersionId: contentVersionId ?? '',
  };
}
