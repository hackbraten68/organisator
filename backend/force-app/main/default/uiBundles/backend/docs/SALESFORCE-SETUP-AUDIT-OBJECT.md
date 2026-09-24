# Salesforce Setup: AuditEvent__c Custom Object

This guide describes how to create and deploy the `AuditEvent__c` custom object required by the centralized audit system.

## Prerequisites

- Salesforce org admin access
- Salesforce CLI (`sf`) installed
- Git repository cloned locally

## Step 1: Create Custom Object Metadata

Create the file `custom_objects/AuditEvent__c.object-meta.xml` in your Salesforce project:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <actionOverrides>
        <actionName>Accept</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>CancelEdit</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>Clone</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>Close</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>CreateCallout</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>Delete</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>Edit</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>ExecuteFlow</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>List</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>New</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>SaveEdit</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>Tab</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>View</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>ViewEdit</actionName>
        <type>Default</type>
    </actionOverrides>
    <allowInChatterGroups>false</allowInChatterGroups>
    <compactLayoutAssignment>SYSTEM</compactLayoutAssignment>
    <deploymentStatus>Deployed</deploymentStatus>
    <description>Immutable, append-only audit event log for all operational mutations across Organisator.</description>
    <enableActivities>false</enableActivities>
    <enableBulkApi>true</enableBulkApi>
    <enableChangeDataCapture>false</enableChangeDataCapture>
    <enableFeeds>false</enableFeeds>
    <enableHistory>false</enableHistory>
    <enableLicensing>false</enableLicensing>
    <enableReports>true</enableReports>
    <enableSearch>true</enableSearch>
    <enableSharing>true</enableSharing>
    <enableStreamingApi>true</enableStreamingApi>
    <externalDataSource/>
    <externalRepository/>
    <fields>
        <!-- Timestamp: when the event occurred -->
        <fullName>OccurredAt__c</fullName>
        <description>Timestamp of when the audited event actually occurred (may differ from CreatedDate due to async processing).</description>
        <externalId>false</externalId>
        <label>Occurred At</label>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>DateTime</type>
    </fields>

    <fields>
        <!-- Event type identifier: "domain.action" -->
        <fullName>EventType__c</fullName>
        <description>Stable event type identifier (e.g., 'participant.status_changed'). Used for filtering and routing.</description>
        <externalId>false</externalId>
        <label>Event Type</label>
        <length>80</length>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>Text</type>
        <unique>false</unique>
    </fields>

    <fields>
        <!-- Schema version for forward compatibility -->
        <fullName>SchemaVersion__c</fullName>
        <description>Schema version of this audit event. Incremented when event structure changes.</description>
        <externalId>false</externalId>
        <label>Schema Version</label>
        <precision>3</precision>
        <required>true</required>
        <scale>0</scale>
        <trackHistory>false</trackHistory>
        <type>Number</type>
        <unique>false</unique>
    </fields>

    <fields>
        <!-- Domain: which part of the app was affected -->
        <fullName>Domain__c</fullName>
        <externalId>false</externalId>
        <label>Domain</label>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>Picklist</type>
        <valueSet>
            <restricted>true</restricted>
            <sortingOrder>Picklist</sortingOrder>
            <value>
                <fullName>participant</fullName>
                <default>false</default>
                <label>Participant</label>
            </value>
            <value>
                <fullName>workbook</fullName>
                <default>false</default>
                <label>Workbook</label>
            </value>
            <value>
                <fullName>absence</fullName>
                <default>false</default>
                <label>Absence</label>
            </value>
            <value>
                <fullName>appointment</fullName>
                <default>false</default>
                <label>Appointment</label>
            </value>
            <value>
                <fullName>classbook</fullName>
                <default>false</default>
                <label>Klassenbuch</label>
            </value>
            <value>
                <fullName>daily_checkin</fullName>
                <default>false</default>
                <label>Daily Check-In</label>
            </value>
            <value>
                <fullName>time_tracking</fullName>
                <default>false</default>
                <label>Time Tracking</label>
            </value>
            <value>
                <fullName>authentication</fullName>
                <default>false</default>
                <label>Authentication</label>
            </value>
            <value>
                <fullName>system</fullName>
                <default>false</default>
                <label>System</label>
            </value>
        </valueSet>
    </fields>

    <fields>
        <!-- Action: what kind of change -->
        <fullName>Action__c</fullName>
        <externalId>false</externalId>
        <label>Action</label>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>Picklist</type>
        <valueSet>
            <restricted>true</restricted>
            <sortingOrder>Picklist</sortingOrder>
            <value>
                <fullName>created</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>updated</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>deleted</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>archived</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>restored</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>status_changed</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>submitted</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>approved</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>rejected</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>cancelled</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>checked_in</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>checked_out</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>corrected</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>flagged</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>reviewed</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>rescheduled</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>attendance_changed</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>document_added</fullName>
                <default>false</default>
            </value>
        </valueSet>
    </fields>

    <fields>
        <!-- Actor type: who performed the action -->
        <fullName>ActorType__c</fullName>
        <externalId>false</externalId>
        <label>Actor Type</label>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>Picklist</type>
        <valueSet>
            <restricted>true</restricted>
            <sortingOrder>Picklist</sortingOrder>
            <value>
                <fullName>staff</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>participant</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>system</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>integration</fullName>
                <default>false</default>
            </value>
        </valueSet>
    </fields>

    <fields>
        <!-- Actor ID: who performed the action -->
        <fullName>ActorId__c</fullName>
        <description>Salesforce User ID or system process identifier (e.g., batch job name).</description>
        <externalId>false</externalId>
        <label>Actor ID</label>
        <length>18</length>
        <required>false</required>
        <trackHistory>false</trackHistory>
        <type>Text</type>
        <unique>false</unique>
    </fields>

    <fields>
        <!-- Actor display name snapshot -->
        <fullName>ActorDisplayName__c</fullName>
        <description>Frozen snapshot of actor's display name at time of event. Allows identifying actors even if user records are later deleted.</description>
        <externalId>false</externalId>
        <label>Actor Display Name Snapshot</label>
        <length>255</length>
        <required>false</required>
        <trackHistory>false</trackHistory>
        <type>Text</type>
        <unique>false</unique>
    </fields>

    <fields>
        <!-- Subject type: entity affected -->
        <fullName>SubjectType__c</fullName>
        <description>Type of entity affected by the event (e.g., 'Participant__c', 'Workbook__c').</description>
        <externalId>false</externalId>
        <label>Subject Type</label>
        <length>80</length>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>Text</type>
        <unique>false</unique>
    </fields>

    <fields>
        <!-- Subject ID: entity ID affected -->
        <fullName>SubjectId__c</fullName>
        <description>Salesforce record ID of the entity affected by the event.</description>
        <externalId>false</externalId>
        <label>Subject ID</label>
        <length>18</length>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>Text</type>
        <unique>false</unique>
    </fields>

    <fields>
        <!-- Participant lookup: for participant-centric filtering -->
        <fullName>ParticipantId__c</fullName>
        <description>Lookup to Participant__c for participant-centric queries. May differ from SubjectId if subject is not a participant.</description>
        <externalId>false</externalId>
        <label>Participant</label>
        <referenceTo>Participant__c</referenceTo>
        <relationshipLabel>Audit Events</relationshipLabel>
        <relationshipName>AuditEvents</relationshipName>
        <required>false</required>
        <trackHistory>false</trackHistory>
        <type>Lookup</type>
    </fields>

    <fields>
        <!-- Parent type: if subject is nested -->
        <fullName>ParentType__c</fullName>
        <description>Type of parent entity (e.g., 'Program__c'), if subject is a child record.</description>
        <externalId>false</externalId>
        <label>Parent Type</label>
        <length>80</length>
        <required>false</required>
        <trackHistory>false</trackHistory>
        <type>Text</type>
        <unique>false</unique>
    </fields>

    <fields>
        <!-- Parent ID: if subject is nested -->
        <fullName>ParentId__c</fullName>
        <description>Salesforce record ID of parent entity, if applicable.</description>
        <externalId>false</externalId>
        <label>Parent ID</label>
        <length>18</length>
        <required>false</required>
        <trackHistory>false</trackHistory>
        <type>Text</type>
        <unique>false</unique>
    </fields>

    <fields>
        <!-- Source: how the action was triggered -->
        <fullName>Source__c</fullName>
        <externalId>false</externalId>
        <label>Source</label>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>Picklist</type>
        <valueSet>
            <restricted>true</restricted>
            <sortingOrder>Picklist</sortingOrder>
            <value>
                <fullName>web</fullName>
                <default>true</default>
            </value>
            <value>
                <fullName>mobile</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>api</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>import</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>automation</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>integration</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>migration</fullName>
                <default>false</default>
            </value>
        </valueSet>
    </fields>

    <fields>
        <!-- Correlation ID: groups related events -->
        <fullName>CorrelationId__c</fullName>
        <description>UUID grouping related events belonging to one business transaction.</description>
        <externalId>false</externalId>
        <label>Correlation ID</label>
        <length>36</length>
        <required>false</required>
        <trackHistory>false</trackHistory>
        <type>Text</type>
        <unique>false</unique>
    </fields>

    <fields>
        <!-- Request ID: for idempotency -->
        <fullName>RequestId__c</fullName>
        <description>UUID for request idempotency. Prevents duplicate events on retry.</description>
        <externalId>true</externalId>
        <label>Request ID</label>
        <length>36</length>
        <required>false</required>
        <trackHistory>false</trackHistory>
        <type>Text</type>
        <unique>true</unique>
    </fields>

    <fields>
        <!-- Reason: for corrections, sensitive changes -->
        <fullName>Reason__c</fullName>
        <description>Justification for corrections, sensitive changes, or rejections. Required for some event types.</description>
        <externalId>false</externalId>
        <label>Reason</label>
        <length>1000</length>
        <required>false</required>
        <trackHistory>false</trackHistory>
        <type>Text</type>
        <unique>false</unique>
    </fields>

    <fields>
        <!-- Changed fields list -->
        <fullName>ChangedFields__c</fullName>
        <description>JSON array of field names that changed. Limit: 4000 chars.</description>
        <externalId>false</externalId>
        <label>Changed Fields</label>
        <length>4000</length>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>Text</type>
        <unique>false</unique>
    </fields>

    <fields>
        <!-- Field-level changes JSON -->
        <fullName>Changes__c</fullName>
        <description>JSON array of field change objects with old/new values and metadata. Long text to support large payloads.</description>
        <externalId>false</externalId>
        <label>Changes</label>
        <length>131072</length>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>LongTextArea</type>
        <visibleLines>3</visibleLines>
    </fields>

    <fields>
        <!-- Metadata JSON -->
        <fullName>Metadata__c</fullName>
        <description>JSON object containing allowlisted domain-specific context metadata.</description>
        <externalId>false</externalId>
        <label>Metadata</label>
        <length>131072</length>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>LongTextArea</type>
        <visibleLines>3</visibleLines>
    </fields>

    <fields>
        <!-- Visibility: who can access this event -->
        <fullName>Visibility__c</fullName>
        <externalId>false</externalId>
        <label>Visibility</label>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>Picklist</type>
        <valueSet>
            <restricted>true</restricted>
            <sortingOrder>Picklist</sortingOrder>
            <value>
                <fullName>staff</fullName>
                <default>true</default>
            </value>
            <value>
                <fullName>participant</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>restricted</fullName>
                <default>false</default>
            </value>
        </valueSet>
    </fields>

    <fields>
        <!-- Sensitivity: data protection level -->
        <fullName>Sensitivity__c</fullName>
        <externalId>false</externalId>
        <label>Sensitivity</label>
        <required>true</required>
        <trackHistory>false</trackHistory>
        <type>Picklist</type>
        <valueSet>
            <restricted>true</restricted>
            <sortingOrder>Picklist</sortingOrder>
            <value>
                <fullName>normal</fullName>
                <default>true</default>
            </value>
            <value>
                <fullName>personal</fullName>
                <default>false</default>
            </value>
            <value>
                <fullName>restricted</fullName>
                <default>false</default>
            </value>
        </valueSet>
    </fields>

    <label>Audit Event</label>
    <listViews>
        <fullName>All</fullName>
        <columns>NAME</columns>
        <columns>OccurredAt__c</columns>
        <columns>Domain__c</columns>
        <columns>Action__c</columns>
        <columns>ActorType__c</columns>
        <columns>ActorDisplayName__c</columns>
        <columns>SubjectType__c</columns>
        <columns>CREATED_DATE</columns>
        <filterScope>Everything</filterScope>
        <label>All</label>
    </listViews>
    <nameField>
        <label>Event ID</label>
        <type>AutoNumber</type>
        <displayFormat>AE-{000000}</displayFormat>
    </nameField>
    <pluralLabel>Audit Events</pluralLabel>
    <searchLayouts/>
    <sharingModel>Private</sharingModel>
    <visibility>Public</visibility>
</CustomObject>
```

## Step 2: Create Field Index Metadata

Create `indexes/AuditEvent__c.index-meta.xml` to optimize queries:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomObjectTranslation xmlns="http://soap.sforce.com/2006/04/metadata">
    <indexes>
        <name>idx_ParticipantOccurred</name>
        <fields>
            <name>ParticipantId__c</name>
            <sortDirection>Ascending</sortDirection>
        </fields>
        <fields>
            <name>OccurredAt__c</name>
            <sortDirection>Descending</sortDirection>
        </fields>
    </indexes>
    <indexes>
        <name>idx_DomainOccurred</name>
        <fields>
            <name>Domain__c</name>
            <sortDirection>Ascending</sortDirection>
        </fields>
        <fields>
            <name>OccurredAt__c</name>
            <sortDirection>Descending</sortDirection>
        </fields>
    </indexes>
    <indexes>
        <name>idx_SubjectOccurred</name>
        <fields>
            <name>SubjectType__c</name>
            <sortDirection>Ascending</sortDirection>
        </fields>
        <fields>
            <name>SubjectId__c</name>
            <sortDirection>Ascending</sortDirection>
        </fields>
        <fields>
            <name>OccurredAt__c</name>
            <sortDirection>Descending</sortDirection>
        </fields>
    </indexes>
    <indexes>
        <name>idx_CorrelationId</name>
        <fields>
            <name>CorrelationId__c</name>
            <sortDirection>Ascending</sortDirection>
        </fields>
    </indexes>
</CustomObjectTranslation>
```

## Step 3: Deploy

```bash
# Validate the deployment
sf project deploy start --source-dir force-app/main/default/objects/AuditEvent__c --dry-run

# Deploy
sf project deploy start --source-dir force-app/main/default/objects/AuditEvent__c --target-org <alias>
```

## Step 4: Verify

1. Log in to Salesforce org
2. Navigate to Setup → Custom Objects → Audit Event
3. Verify fields are present and indexed
4. Run GraphQL query to test:

```graphql
query {
  uiapi {
    query {
      AuditEvent__c(first: 10) {
        edges {
          node {
            Id
            EventType__c { value }
          }
        }
      }
    }
  }
}
```

## Troubleshooting

### Deployment fails: "Field type not supported"

Ensure Salesforce org supports LongTextArea (131K limit). If not, split into multiple fields.

### GraphQL query returns empty

Object was created but Salesforce GraphQL schema hasn't updated. Force schema refresh:

```bash
sf graphql:codegen
```

### Permissions error when creating records

Ensure user has create permission on `AuditEvent__c`. Add via permission set if needed.

