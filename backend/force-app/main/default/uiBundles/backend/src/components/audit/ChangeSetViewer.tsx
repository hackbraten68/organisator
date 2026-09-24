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
    Type: 'Typ',
    StartTime: 'Startzeit',
    EndTime: 'Endzeit',
    Reason: 'Grund',
    Status: 'Status',
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
            <p className="text-xs text-amber-600 italic">
              Feld wurde geändert (Wert geschwärzt)
            </p>
          ) : change.oldValue === undefined ? (
            // Creation
            <p className="text-xs">
              <span className="text-green-600">+</span>{' '}
              <code className="bg-green-50 px-1 rounded">
                {formatValue(change.newValue)}
              </code>
            </p>
          ) : change.newValue === undefined ? (
            // Deletion
            <p className="text-xs">
              <span className="text-red-600">−</span>{' '}
              <code className="bg-red-50 px-1 rounded">
                {formatValue(change.oldValue)}
              </code>
            </p>
          ) : (
            // Update
            <div className="text-xs space-y-1">
              <p>
                <span className="text-red-600">von:</span>{' '}
                <code className="bg-red-50 px-1 rounded">
                  {formatValue(change.oldValue)}
                </code>
              </p>
              <p>
                <span className="text-green-600">zu:</span>{' '}
                <code className="bg-green-50 px-1 rounded">
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
