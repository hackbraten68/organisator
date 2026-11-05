/**
 * Read-only coach view of "Mein Lernen" (Workbook).
 *
 * Coaches receive View All Records on the four workbook objects through the
 * backend_Coach permission set. There is no write path here: participant data
 * is immutable in this view, and coach feedback is not part of the MVP.
 */
import { executeGraphQL } from '@/api/graphqlClient';
import SUPPORT_OVERVIEW_RAW from './query/GetWorkbookSupportOverview.graphql?raw';
import PARTICIPANT_WORKBOOK_RAW from './query/GetParticipantWorkbook.graphql?raw';
import DAY_OVERVIEW_RAW from './query/GetWorkbookDayOverview.graphql?raw';
import EXPORT_RAW from './query/GetWorkbookExport.graphql?raw';

type Scalar<T = string> = { value?: T | null } | null | undefined;

export interface CoachCheckIn {
  id: string;
  participantId: string | null;
  participantName: string | null;
  date: string | null;
  status: string | null;
  checkInAt: string | null;
  checkInSource: string | null;
  supportStatus: string | null;
  supportNote: string | null;
  focus: string | null;
  nextStep: string | null;
  closedAt: string | null;
}

export interface CoachSupportTask {
  id: string;
  participantId: string | null;
  participantName: string | null;
  title: string | null;
  status: string | null;
  plannedDate: string | null;
  supportNote: string | null;
  isFocus: boolean | null;
  needsSupport: boolean | null;
  completedAt: string | null;
  source: string | null;
}

export interface CoachFeedbackRequest {
  id: string;
  participantId: string | null;
  participantName: string | null;
  title: string | null;
  type: string | null;
  createdAt: string | null;
  feedbackStatus: string | null;
}

export interface WorkbookSupportOverview {
  checkIns: CoachCheckIn[];
  supportTasks: CoachSupportTask[];
  feedbackEvidence: CoachFeedbackRequest[];
}

export interface WorkbookDayOverview {
  date: string;
  totalDays: number;
  closedDays: number;
  openDays: number;
  checkedInCount: number;
  taskCount: number;
  doneTaskCount: number;
  focusTaskCount: number;
  supportTaskCount: number;
  evidenceCount: number;
  days: CoachCheckIn[];
  tasks: CoachSupportTask[];
  evidence: CoachFeedbackRequest[];
}

export interface WorkbookExportEntry {
  type: string;
  date: string | null;
  participant: string | null;
  title: string | null;
  status: string | null;
  details: string | null;
}

export interface WorkbookExportData {
  days: CoachCheckIn[];
  tasks: CoachSupportTask[];
  evidence: CoachFeedbackRequest[];
}

export interface ParticipantWorkbookDay {
  id: string;
  date: string | null;
  status: string | null;
  checkInAt: string | null;
  checkInSource: string | null;
  supportStatus: string | null;
  supportNote: string | null;
  focus: string | null;
  selfRating: string | null;
  nextStep: string | null;
  closedAt: string | null;
  lastReopenedAt: string | null;
}

export interface ParticipantWorkbookTask {
  id: string;
  title: string | null;
  status: string | null;
  plannedDate: string | null;
  isFocus: boolean | null;
  needsSupport: boolean | null;
  supportNote: string | null;
  source: string | null;
  completedAt: string | null;
  createdAt: string | null;
}

export interface ParticipantWorkbookEvidence {
  id: string;
  title: string | null;
  type: string | null;
  url: string | null;
  note: string | null;
  feedbackStatus: string | null;
  coachFeedback: string | null;
  coachFeedbackAt: string | null;
  createdAt: string | null;
  taskId: string | null;
}

export interface ParticipantWorkbook {
  days: ParticipantWorkbookDay[];
  tasks: ParticipantWorkbookTask[];
  evidence: ParticipantWorkbookEvidence[];
}

interface Connection<T> {
  edges?: Array<{ node?: T | null } | null> | null;
}

interface SupportOverviewResponse {
  uiapi?: {
    query?: {
      checkIns?: Connection<{
        Id: string;
        Date__c?: Scalar;
        Status__c?: Scalar;
        CheckInAt__c?: Scalar;
        CheckInSource__c?: Scalar;
        SupportStatus__c?: Scalar;
        SupportNote__c?: Scalar;
        Participant__c?: Scalar;
        Participant__r?: { Name?: Scalar } | null;
      }> | null;
      supportTasks?: Connection<{
        Id: string;
        Title__c?: Scalar;
        Status__c?: Scalar;
        PlannedDate__c?: Scalar;
        SupportNote__c?: Scalar;
        Participant__c?: Scalar;
        Participant__r?: { Name?: Scalar } | null;
      }> | null;
      feedbackEvidence?: Connection<{
        Id: string;
        Title__c?: Scalar;
        Type__c?: Scalar;
        CreatedDate?: Scalar;
        Participant__c?: Scalar;
        Participant__r?: { Name?: Scalar } | null;
      }> | null;
    } | null;
  } | null;
}

interface ParticipantWorkbookResponse {
  uiapi?: {
    query?: {
      days?: Connection<{
        Id: string;
        Date__c?: Scalar;
        Status__c?: Scalar;
        CheckInAt__c?: Scalar;
        CheckInSource__c?: Scalar;
        SupportStatus__c?: Scalar;
        SupportNote__c?: Scalar;
        Focus__c?: Scalar;
        SelfRating__c?: Scalar;
        NextStep__c?: Scalar;
        ClosedAt__c?: Scalar;
        LastReopenedAt__c?: Scalar;
      }> | null;
      tasks?: Connection<{
        Id: string;
        Title__c?: Scalar;
        Status__c?: Scalar;
        PlannedDate__c?: Scalar;
        IsFocus__c?: Scalar<boolean>;
        NeedsSupport__c?: Scalar<boolean>;
        SupportNote__c?: Scalar;
        Source__c?: Scalar;
        CompletedAt__c?: Scalar;
        CreatedDate?: Scalar;
      }> | null;
      evidence?: Connection<{
        Id: string;
        Title__c?: Scalar;
        Type__c?: Scalar;
        URL__c?: Scalar;
        Note__c?: Scalar;
        FeedbackStatus__c?: Scalar;
        CoachFeedback__c?: Scalar;
        CoachFeedbackAt__c?: Scalar;
        CreatedDate?: Scalar;
        Task__c?: Scalar;
      }> | null;
    } | null;
  } | null;
}

interface DayOverviewResponse {
  uiapi?: {
    query?: {
      days?: Connection<{
        Id: string;
        Date__c?: Scalar;
        Status__c?: Scalar;
        CheckInAt__c?: Scalar;
        CheckInSource__c?: Scalar;
        SupportStatus__c?: Scalar;
        SupportNote__c?: Scalar;
        Focus__c?: Scalar;
        SelfRating__c?: Scalar;
        NextStep__c?: Scalar;
        ClosedAt__c?: Scalar;
        LastReopenedAt__c?: Scalar;
        Participant__c?: Scalar;
        Participant__r?: { Name?: Scalar } | null;
      }> | null;
      tasks?: Connection<{
        Id: string;
        Title__c?: Scalar;
        Status__c?: Scalar;
        IsFocus__c?: Scalar<boolean>;
        NeedsSupport__c?: Scalar<boolean>;
        SupportNote__c?: Scalar;
        PlannedDate__c?: Scalar;
        Participant__c?: Scalar;
        Participant__r?: { Name?: Scalar } | null;
      }> | null;
      evidence?: Connection<{
        Id: string;
        Title__c?: Scalar;
        Type__c?: Scalar;
        FeedbackStatus__c?: Scalar;
        CreatedDate?: Scalar;
        Participant__c?: Scalar;
        Participant__r?: { Name?: Scalar } | null;
      }> | null;
    } | null;
  } | null;
}

interface ExportResponse {
  uiapi?: {
    query?: {
      days?: Connection<{
        Id: string;
        Date__c?: Scalar;
        Status__c?: Scalar;
        CheckInAt__c?: Scalar;
        CheckInSource__c?: Scalar;
        SupportStatus__c?: Scalar;
        SupportNote__c?: Scalar;
        Focus__c?: Scalar;
        NextStep__c?: Scalar;
        ClosedAt__c?: Scalar;
        Participant__c?: Scalar;
        Participant__r?: { Name?: Scalar } | null;
      }> | null;
      tasks?: Connection<{
        Id: string;
        Title__c?: Scalar;
        Status__c?: Scalar;
        IsFocus__c?: Scalar<boolean>;
        NeedsSupport__c?: Scalar<boolean>;
        SupportNote__c?: Scalar;
        PlannedDate__c?: Scalar;
        Source__c?: Scalar;
        CompletedAt__c?: Scalar;
        Participant__c?: Scalar;
        Participant__r?: { Name?: Scalar } | null;
      }> | null;
      evidence?: Connection<{
        Id: string;
        Title__c?: Scalar;
        Type__c?: Scalar;
        FeedbackStatus__c?: Scalar;
        CreatedDate?: Scalar;
        Participant__c?: Scalar;
        Participant__r?: { Name?: Scalar } | null;
      }> | null;
    } | null;
  } | null;
}
function value<T>(input: Scalar<T>): T | null {
  return input?.value ?? null;
}

function nodes<T>(connection: Connection<T> | null | undefined): T[] {
  return (connection?.edges ?? [])
    .map((edge) => edge?.node)
    .filter((node): node is T => node != null);
}

export async function getWorkbookSupportOverview(
  today: string,
): Promise<WorkbookSupportOverview> {
  const data = await executeGraphQL<
    SupportOverviewResponse,
    { today: string; checkInLimit: number; supportLimit: number; feedbackLimit: number }
  >(SUPPORT_OVERVIEW_RAW, {
    today,
    checkInLimit: 100,
    supportLimit: 20,
    feedbackLimit: 15,
  });

  const query = data.uiapi?.query;
  return {
    checkIns: nodes(query?.checkIns).map((node) => ({
      id: node.Id,
      participantId: value(node.Participant__c),
      participantName: value(node.Participant__r?.Name),
      date: value(node.Date__c),
      status: value(node.Status__c),
      checkInAt: value(node.CheckInAt__c),
      checkInSource: value(node.CheckInSource__c),
      supportStatus: value(node.SupportStatus__c),
      supportNote: value(node.SupportNote__c),
      focus: null,
      nextStep: null,
      closedAt: null,
    })),
    supportTasks: nodes(query?.supportTasks).map((node) => ({
      id: node.Id,
      participantId: value(node.Participant__c),
      participantName: value(node.Participant__r?.Name),
      title: value(node.Title__c),
      status: value(node.Status__c),
      plannedDate: value(node.PlannedDate__c),
      supportNote: value(node.SupportNote__c),
      isFocus: null,
      needsSupport: null,
      completedAt: null,
      source: null,
    })),
    feedbackEvidence: nodes(query?.feedbackEvidence).map((node) => ({
      id: node.Id,
      participantId: value(node.Participant__c),
      participantName: value(node.Participant__r?.Name),
      title: value(node.Title__c),
      type: value(node.Type__c),
      createdAt: value(node.CreatedDate),
      feedbackStatus: null,
    })),
  };
}

export async function getParticipantWorkbook(
  participantId: string,
): Promise<ParticipantWorkbook> {
  const data = await executeGraphQL<
    ParticipantWorkbookResponse,
    { participantId: string }
  >(PARTICIPANT_WORKBOOK_RAW, { participantId });

  const query = data.uiapi?.query;
  return {
    days: nodes(query?.days).map((node) => ({
      id: node.Id,
      date: value(node.Date__c),
      status: value(node.Status__c),
      checkInAt: value(node.CheckInAt__c),
      checkInSource: value(node.CheckInSource__c),
      supportStatus: value(node.SupportStatus__c),
      supportNote: value(node.SupportNote__c),
      focus: value(node.Focus__c),
      selfRating: value(node.SelfRating__c),
      nextStep: value(node.NextStep__c),
      closedAt: value(node.ClosedAt__c),
      lastReopenedAt: value(node.LastReopenedAt__c),
    })),
    tasks: nodes(query?.tasks).map((node) => ({
      id: node.Id,
      title: value(node.Title__c),
      status: value(node.Status__c),
      plannedDate: value(node.PlannedDate__c),
      isFocus: value(node.IsFocus__c),
      needsSupport: value(node.NeedsSupport__c),
      supportNote: value(node.SupportNote__c),
      source: value(node.Source__c),
      completedAt: value(node.CompletedAt__c),
      createdAt: value(node.CreatedDate),
    })),
    evidence: nodes(query?.evidence).map((node) => ({
      id: node.Id,
      title: value(node.Title__c),
      type: value(node.Type__c),
      url: value(node.URL__c),
      note: value(node.Note__c),
      feedbackStatus: value(node.FeedbackStatus__c),
      coachFeedback: value(node.CoachFeedback__c),
      coachFeedbackAt: value(node.CoachFeedbackAt__c),
      createdAt: value(node.CreatedDate),
      taskId: value(node.Task__c),
    })),
  };
}

export async function getWorkbookDayOverview(
  day: string,
): Promise<WorkbookDayOverview> {
  const start = new Date(`${day}T00:00:00`).toISOString();
  const end = new Date(`${day}T23:59:59.999`).toISOString();
  const data = await executeGraphQL<
    DayOverviewResponse,
    { today: string; start: string; end: string }
  >(DAY_OVERVIEW_RAW, { today: day, start, end });

  const query = data.uiapi?.query;
  const days = nodes(query?.days).map((node) => ({
    id: node.Id,
    participantId: value(node.Participant__c),
    participantName: value(node.Participant__r?.Name),
    date: value(node.Date__c),
    status: value(node.Status__c),
    checkInAt: value(node.CheckInAt__c),
    checkInSource: value(node.CheckInSource__c),
    supportStatus: value(node.SupportStatus__c),
    supportNote: value(node.SupportNote__c),
    focus: value(node.Focus__c),
    selfRating: value(node.SelfRating__c),
    nextStep: value(node.NextStep__c),
    closedAt: value(node.ClosedAt__c),
    lastReopenedAt: value(node.LastReopenedAt__c),
  }));
  const tasks = nodes(query?.tasks).map((node) => ({
    id: node.Id,
    participantId: value(node.Participant__c),
    participantName: value(node.Participant__r?.Name),
    title: value(node.Title__c),
    status: value(node.Status__c),
    plannedDate: value(node.PlannedDate__c),
    isFocus: value(node.IsFocus__c),
    needsSupport: value(node.NeedsSupport__c),
    supportNote: value(node.SupportNote__c),
    completedAt: null,
    source: null,
  }));
  const evidence = nodes(query?.evidence).map((node) => ({
    id: node.Id,
    participantId: value(node.Participant__c),
    participantName: value(node.Participant__r?.Name),
    title: value(node.Title__c),
    type: value(node.Type__c),
    feedbackStatus: value(node.FeedbackStatus__c),
    createdAt: value(node.CreatedDate),
  }));

  return {
    date: day,
    totalDays: days.length,
    closedDays: days.filter((item) => item.status === 'Closed').length,
    openDays: days.filter((item) => item.status !== 'Closed').length,
    checkedInCount: days.filter((item) => item.checkInAt != null).length,
    taskCount: tasks.length,
    doneTaskCount: tasks.filter((item) => item.status === 'Done').length,
    focusTaskCount: tasks.filter((item) => item.isFocus).length,
    supportTaskCount: tasks.filter((item) => item.needsSupport).length,
    evidenceCount: evidence.length,
    days,
    tasks,
    evidence,
  };
}

export async function getWorkbookExportData(): Promise<WorkbookExportData> {
  const data = await executeGraphQL<ExportResponse, Record<string, never>>(
    EXPORT_RAW,
    {},
  );
  const query = data.uiapi?.query;
  return {
    days: nodes(query?.days).map((node) => ({
      id: node.Id,
      participantId: value(node.Participant__c),
      participantName: value(node.Participant__r?.Name),
      date: value(node.Date__c),
      status: value(node.Status__c),
      checkInAt: value(node.CheckInAt__c),
      checkInSource: value(node.CheckInSource__c),
      supportStatus: value(node.SupportStatus__c),
      supportNote: value(node.SupportNote__c),
      focus: value(node.Focus__c),
      nextStep: value(node.NextStep__c),
      closedAt: value(node.ClosedAt__c),
      offDay: null,
      offDayReason: null,
    })),
    tasks: nodes(query?.tasks).map((node) => ({
      id: node.Id,
      participantId: value(node.Participant__c),
      participantName: value(node.Participant__r?.Name),
      title: value(node.Title__c),
      status: value(node.Status__c),
      plannedDate: value(node.PlannedDate__c),
      isFocus: value(node.IsFocus__c),
      needsSupport: value(node.NeedsSupport__c),
      supportNote: value(node.SupportNote__c),
      source: value(node.Source__c),
      completedAt: value(node.CompletedAt__c),
    })),
    evidence: nodes(query?.evidence).map((node) => ({
      id: node.Id,
      participantId: value(node.Participant__c),
      participantName: value(node.Participant__r?.Name),
      title: value(node.Title__c),
      type: value(node.Type__c),
      feedbackStatus: value(node.FeedbackStatus__c),
      createdAt: value(node.CreatedDate),
    })),
  };
}

