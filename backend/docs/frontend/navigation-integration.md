# Navigation Integration

## Discovery

The application navigation is generated dynamically.

Source:

```text
src/appLayout.tsx
```

Navigation entries are built from route metadata.

---

## Navigation Rule

Routes are displayed when:

```tsx
handle: {
  showInNavigation: true,
  label: "Some Label"
}
```

is present.

---

## Example

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

## Result

The new page will automatically appear in the navigation menu.

No changes to:

```text
src/appLayout.tsx
```

are required.

---

## Existing Navigation Entries

Current:

```text
Home
Search
```

After implementation:

```text
Home
Search
Participants
```

---

## Future Academy Navigation

Potential future routes:

```text
Participants
Programs
Coaches
Opportunities
Academy Dashboard
```

All can be added via route metadata.

Example:

```tsx
{
  path: "programs",
  element: <ProgramPage />,
  handle: {
    showInNavigation: true,
    label: "Programs"
  }
}
```
