# Participant Route Registration

## Goal

Expose the Academy Participant Management screen through the application router.

---

## Route

```text
/participants
```

---

## Navigation Entry

```ts
handle: {
  showInNavigation: true,
  label: "Participants"
}
```

This follows the same pattern used by:

- Home
- Search

and should automatically appear in navigation if the layout reads route handles.

---

## Route Definition

```tsx
{
  path: "participants",
  element: <ParticipantPage />,
  handle: {
    showInNavigation: true,
    label: "Participants"
  }
}
```

---

## Page Location

```text
src/pages/ParticipantPage.tsx
```

---

## First Goal

Render a basic page shell.

```text
Participants

Participant selector

Participant detail form

Save button
```

Before integrating Salesforce data.
