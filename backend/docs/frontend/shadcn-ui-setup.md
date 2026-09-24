# Shadcn UI Setup

## Goal

Create a React + TypeScript frontend using Vite, Tailwind CSS, and shadcn/ui.

This frontend will become the Academy administration interface for:

- Participants
- Programs
- Coaches

---

## Create Project

From the Organisator root directory:

```bash
npm create vite@latest frontend -- --template react-ts
```

Enter project:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

---

## Install Tailwind CSS

```bash
npm install tailwindcss @tailwindcss/vite
```

Update:

```ts
// vite.config.ts

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
```

---

## Configure CSS

Replace src/index.css:

```css
@import "tailwindcss";
```

---

## Install React Router

```bash
npm install react-router-dom
```

---

## Install React Query

```bash
npm install @tanstack/react-query
```

---

## Install Icons

```bash
npm install lucide-react
```

---

## Install shadcn/ui

```bash
npx shadcn@latest init
```

Recommended answers:

```text
Style: New York
Base Color: Slate
CSS Variables: Yes
Components: src/components
Utils: src/lib/utils.ts
```

---

## Install First Components

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add select
npx shadcn@latest add textarea
npx shadcn@latest add dialog
npx shadcn@latest add toast
```

---

## Run Application

```bash
npm run dev
```

Expected result:

```text
http://localhost:5173
```

---

## Next Step

Create the first page:

```text
/participants
```

Features:

- Participant selection
- Edit participant data
- Program dropdown
- Coach dropdown
- Save button

Backed by mock data initially.
