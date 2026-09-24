# Frontend MVP Plan

## Objective

Build the first working React frontend for Organisator that allows users to manage Salesforce Academy participants.

The MVP should support:

- View participants
- Select a participant
- Edit participant fields
- Assign a Program
- Assign a Coach
- Save changes back to Salesforce

---

## Scope

### Included

Participant management:

- List participants
- View participant details
- Edit participant details
- Update Program lookup
- Update Coach lookup

Program management:

- Read only

Coach management:

- Read only

---

## Not Included Yet

- Opportunity integration
- Lead conversion
- Flow administration
- Authentication
- User management
- Contact management
- Dashboard reporting

---

## Technology Stack

Frontend:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query

Backend:

- Node.js
- Express
- Salesforce REST API

---

## Project Structure

```text
frontend/
├── src/
│
├── pages/
│   └── participants/
│
├── components/
│   ├── participant/
│   ├── coach/
│   ├── program/
│   └── ui/
│
├── hooks/
│
├── services/
│
├── lib/
│
└── types/
```

---

## Screens

### Participants

Route:

```text
/participants
```

Layout:

```text
+--------------------------------------+
| Participants                         |
+--------------------------------------+
| Select Participant                   |
|                                      |
| Name                                 |
| Status                               |
| Email                                |
| GitHub                               |
| Discord                              |
|                                      |
| Program Dropdown                     |
| Coach Dropdown                       |
|                                      |
| Save                                |
+--------------------------------------+
```

---

## Initial API Endpoints

### Participants

```http
GET /api/participants

GET /api/participants/:id

PATCH /api/participants/:id
```

### Programs

```http
GET /api/programs
```

### Coaches

```http
GET /api/coaches
```

---

## Salesforce Queries

### Participants

```sql
SELECT
    Id,
    Name,
    Status__c,
    Email__c,
    GitHub__c,
    Discord__c,
    Program__c,
    Program__r.Name,
    Coach_Profile__c,
    Coach_Profile__r.Name
FROM Participant__c
```

### Programs

```sql
SELECT
    Id,
    Name,
    DurationWeeks__c,
    Description__c
FROM Program__c
```

### Coaches

```sql
SELECT
    Id,
    Name,
    Email__c,
    GitHub__c,
    Discord__c,
    Role__c
FROM Coach_Profile__c
```

---

## Currently Verified Records

Program:

```text
IT Pro
```

Coach:

```text
Sam Dillenburg
```

Participant:

```text
Max Mustermann
```

Relationship Validation:

```text
Participant
  -> Program
  -> Coach
```

Verified by runtime SOQL query.

---

## Next Implementation Step

Create the frontend application:

```bash
npm create vite@latest frontend -- --template react-ts
```

Install dependencies:

```bash
npm install
npm install react-router-dom
npm install @tanstack/react-query
npm install lucide-react
```

Install shadcn/ui:

```bash
npx shadcn@latest init
```

First functional screen:

```text
Participant Management
```

using live Salesforce-backed data.
