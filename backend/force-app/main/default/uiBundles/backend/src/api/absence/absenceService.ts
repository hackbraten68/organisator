import { executeGraphQL } from "@/api/graphqlClient";
import type { Absence, AbsenceInput, AbsencePatch, AbsenceFilters, AbsenceDocument } from "@/types/absence";

export type { Absence, AbsenceInput, AbsencePatch, AbsenceFilters, AbsenceDocument };

import GET_ABSENCE_RAW from "@/api/absence/query/GetAbsence.graphql?raw";
import LIST_ABSENCES_RAW from "@/api/absence/query/ListAbsences.graphql?raw";
import GET_ABSENCES_BY_PARTICIPANT_RAW from "@/api/absence/query/GetAbsencesByParticipant.graphql?raw";
import CREATE_ABSENCE_RAW from "@/api/absence/query/CreateAbsence.graphql?raw";
import UPDATE_ABSENCE_RAW from "@/api/absence/query/UpdateAbsence.graphql?raw";
import APPROVE_ABSENCE_RAW from "@/api/absence/query/ApproveAbsence.graphql?raw";
import REJECT_ABSENCE_RAW from "@/api/absence/query/RejectAbsence.graphql?raw";
import CANCEL_ABSENCE_RAW from "@/api/absence/query/CancelAbsence.graphql?raw";
import GET_ABSENCE_DOCUMENTS_RAW from "@/api/absence/query/GetAbsenceDocuments.graphql?raw";
import CREATE_CONTENT_VERSION_RAW from "@/api/absence/query/CreateContentVersion.graphql?raw";
import GET_DOC_LINK_RAW from "@/api/absence/query/GetDocLink.graphql?raw";

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
  RejectedAt__c?: ScalarValue<string>;
  CoachComment__c?: ScalarValue<string>;
  CreatedDate?: ScalarValue<string>;
  LastModifiedDate?: ScalarValue<string>;
  Participant__r?: { Name?: ScalarValue<string> } | null;
  ApprovedBy__r?: { Name?: ScalarValue<string> } | null;
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

interface ContentDocumentLinkNode {
  Id: string;
  ContentDocumentId: string;
  LinkedEntityId: string;
  ShareType: string;
  Visibility: string;
  ContentDocument: {
    Id: string;
    Title: string;
    FileType: string;
    LatestPublishedVersionId: string;
    ContentVersions: {
      edges: Array<{ node: { Id: string; Title: string; ContentSize: number; FileExtension: string; VersionData: any } }>;
    };
  };
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
  ContentDocumentId: string;
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
    name: node.Name?.value || "",
    participantId: node.Participant__c?.value || "",
    participantName: node.Participant__r?.Name?.value,
    type: node.Type__c?.value as Absence["type"],
    status: node.Status__c?.value as Absence["status"],
    startDate: node.StartDate__c?.value || "",
    endDate: node.EndDate__c?.value || "",
    reason: node.Reason__c?.value,
    approvedById: node.ApprovedBy__c?.value,
    approvedByName: node.ApprovedBy__r?.Name?.value,
    approvedAt: node.ApprovedAt__c?.value,
    rejectedAt: node.RejectedAt__c?.value,
    coachComment: node.CoachComment__c?.value,
    createdAt: node.CreatedDate?.value || "",
    updatedAt: node.LastModifiedDate?.value || "",
  };
}

export async function getAbsence(id: string): Promise<Absence | null> {
  const response = await executeGraphQL<GetAbsenceResponse, { id: string }>(GET_ABSENCE_RAW, { id });
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
  const response = await executeGraphQL<ListAbsencesResponse, typeof vars>(LIST_ABSENCES_RAW, vars);
  const edges = response?.uiapi?.query?.Absence__c?.edges || [];
  const pageInfo = response?.uiapi?.query?.Absence__c?.pageInfo;

  return {
    absences: edges.map((e: any) => mapGqlToAbsence(e.node)),
    hasNextPage: pageInfo?.hasNextPage || false,
    endCursor: pageInfo?.endCursor,
  };
}

export async function getAbsencesByParticipant(participantId: string, first = 50): Promise<Absence[]> {
  const response = await executeGraphQL<GetAbsencesByParticipantResponse, { participantId: string; first: number }>(GET_ABSENCES_BY_PARTICIPANT_RAW, { participantId, first });
  const edges = response?.uiapi?.query?.Absence__c?.edges || [];
  return edges.map((e: any) => mapGqlToAbsence(e.node));
}

export async function createAbsence(input: AbsenceInput): Promise<string> {
  const response = await executeGraphQL<MutationResponse, { participantId: string; type: string; status: string; startDate: string; endDate: string }>(CREATE_ABSENCE_RAW, {
    participantId: input.participantId,
    type: input.type,
    status: input.status || "Submitted",
    startDate: input.startDate,
    endDate: input.endDate,
  });
  return response?.uiapi?.Absence__cCreate?.Record?.Id ?? "";
}

export async function updateAbsence(id: string, patch: AbsencePatch): Promise<void> {
  const vars: Record<string, any> = { id };
  if (patch.type !== undefined) vars.type = patch.type;
  if (patch.status !== undefined) vars.status = patch.status;
  if (patch.startDate !== undefined) vars.startDate = patch.startDate;
  if (patch.endDate !== undefined) vars.endDate = patch.endDate;
  if (patch.reason !== undefined) vars.reason = patch.reason;
  if (patch.approvedById !== undefined) vars.approvedById = patch.approvedById;
  if (patch.approvedAt !== undefined) vars.approvedAt = patch.approvedAt;
  if (patch.rejectedAt !== undefined) vars.rejectedAt = patch.rejectedAt;
  if (patch.coachComment !== undefined) vars.coachComment = patch.coachComment;

  await executeGraphQL<MutationResponse, Record<string, any>>(UPDATE_ABSENCE_RAW, vars);
}

export async function approveAbsence(id: string, approvedById: string): Promise<void> {
  const approvedAt = new Date().toISOString();
  await executeGraphQL<MutationResponse, { id: string; approvedById: string; approvedAt: string }>(APPROVE_ABSENCE_RAW, { id, approvedById, approvedAt });
}

export async function rejectAbsence(id: string, coachComment: string): Promise<void> {
  const rejectedAt = new Date().toISOString();
  await executeGraphQL<MutationResponse, { id: string; rejectedAt: string; coachComment: string }>(REJECT_ABSENCE_RAW, { id, rejectedAt, coachComment });
}

export async function cancelAbsence(id: string): Promise<void> {
  await executeGraphQL<MutationResponse, { id: string }>(CANCEL_ABSENCE_RAW, { id });
}

export async function getAbsenceDocuments(absenceId: string): Promise<AbsenceDocument[]> {
  const response = await executeGraphQL<GetAbsenceDocumentsResponse, { absenceId: string }>(GET_ABSENCE_DOCUMENTS_RAW, { absenceId });

  const edges = response?.uiapi?.query?.ContentDocumentLink?.edges || [];
  return edges.map((e: any) => {
    const link = e.node;
    const doc = link.ContentDocument;
    const version = doc?.ContentVersions?.edges?.[0]?.node;
    return {
      id: link.Id,
      absenceId: link.LinkedEntityId,
      contentDocumentId: link.ContentDocumentId,
      fileName: doc?.Title || "",
      fileSize: version?.ContentSize || 0,
      fileType: doc?.FileType || "",
      uploadedById: "",
      uploadedByName: "",
      uploadedAt: "",
    };
  });
}

export async function uploadAbsenceDocument(
  absenceId: string,
  file: { title: string; pathOnClient: string; versionData: Blob },
  _uploadedById: string
): Promise<{ contentDocumentId: string; contentVersionId: string }> {
  const response = await executeGraphQL<MutationResponse, { title: string; pathOnClient: string; versionData: Blob; firstPublishLocationId: string }>(CREATE_CONTENT_VERSION_RAW, {
    title: file.title,
    pathOnClient: file.pathOnClient,
    versionData: file.versionData,
    firstPublishLocationId: absenceId,
  });

  const contentVersionId = response?.uiapi?.ContentVersionCreate?.Record?.Id;
  if (!contentVersionId) {
    throw new Error("Failed to create ContentVersion");
  }

  const docLinkResponse = await executeGraphQL<GetDocLinkResponse, { cvId: string }>(GET_DOC_LINK_RAW, { cvId: contentVersionId });

  const contentDocumentId = docLinkResponse?.uiapi?.query?.ContentVersion?.edges?.[0]?.node?.ContentDocumentId;

  return { contentDocumentId: contentDocumentId ?? "", contentVersionId: contentVersionId ?? "" };
}