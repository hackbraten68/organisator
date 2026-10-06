/**
 * ChangeSet Viewer Component
 * 
 * Displays field-level changes with before/after values (where not redacted).
 */

import type { FieldChange } from '@/types/audit';

export interface ChangeSetViewerProps {
  changes: FieldChange[];
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(leer)';
  }
  if (typeof value === 'boolean') {
    return value ? 'Ja' : 'Nein';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Get a human-readable field label
 */
function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    Name: 'Name',
    Status__c: 'Status',
    Email__c: 'E-Mail',
    GitHub__c: 'GitHub',
    Discord__c: 'Discord',
    StartDate__c: 'Startdatum',
    ExpectedEndDate__c: 'Erwartetes Enddatum',
    Program__c: 'Programm',
    Coach_Profile__c: 'Coach',
    AnswerText: 'Antwort',
    Type__c: 'Typ',
    StartTime__c: 'Startzeit',
    EndTime__c: 'Endzeit',
    Reason__c: 'Grund',
    CoachComment__c: 'Ablehnungsgrund',
    CancellationReason__c: 'Absagegrund',
    ApprovedBy__c: 'Genehmigt von',
    ApprovedAt__c: 'Genehmigt am',
    RejectedAt__c: 'Abgelehnt am',
    Documents: 'Dokumente',
    Coach__c: 'Coach',
    CorrelationId__c: 'Korrelation',
    Title__c: 'Titel',
    Order__c: 'Position',
    Estimated_Weeks__c: 'Geschätzte Wochen',
    Metadata: 'Metadaten',
  };
  return labels[field] || field;
}

export function ChangeSetViewer({ changes }: ChangeSetViewerProps) {
  if (!changes || changes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {changes.map((change, idx) => (
        <div key={idx} className="text-sm p-2 bg-muted rounded border-l-2 border-primary">
          <p className="font-medium text-xs text-muted-foreground">
            {getFieldLabel(change.field)}
          </p>

          {change.redacted ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 italic">
              Feld wurde geändert (Wert geschwärzt)
            </p>
          ) : change.oldValue === undefined ? (
            // Creation
            <p className="text-xs">
              <span className="text-green-600 dark:text-green-400 font-semibold" aria-hidden="true">+</span>{' '}
              <code className="bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-200 px-1 rounded">
                {formatValue(change.newValue)}
              </code>
            </p>
          ) : change.newValue === undefined ? (
            // Deletion
            <p className="text-xs">
              <span className="text-red-600 dark:text-red-400 font-semibold" aria-hidden="true">−</span>{' '}
              <code className="bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-200 px-1 rounded">
                {formatValue(change.oldValue)}
              </code>
            </p>
          ) : (
            // Update: label + symbol carry the meaning, not color alone.
            <div className="text-xs space-y-1">
              <p>
                <span className="text-red-600 dark:text-red-400 font-semibold">Vorher:</span>{' '}
                <code className="bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-200 px-1 rounded">
                  {formatValue(change.oldValue)}
                </code>
              </p>
              <p>
                <span className="text-green-600 dark:text-green-400 font-semibold">Nachher:</span>{' '}
                <code className="bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-200 px-1 rounded">
                  {formatValue(change.newValue)}
                </code>
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ChangeSetViewer;
