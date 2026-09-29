# External User App (B2X)

## Overview

A ready-to-use starter for building customer- and partner-facing apps on the Salesforce platform. It comes with a clean, modern interface, a complete sign-in experience (login, registration, password reset, and profile management), and the public site setup needed to make the app available to people outside your company. It ships with no data of its own — a clean slate — but includes one working example (an Account search with filtering, sorting, and a detail view) that shows how the app reads Salesforce data, so teams can point it at their own information.

## Problem

Building a customer-facing portal on Salesforce usually means solving the hard parts before any real product work begins: letting people sign in and manage their accounts, keeping public and private areas properly separated, and configuring the public site so it can be served to external users. Getting sign-in right is especially important and easy to get wrong. Until now there has been no simple starting point that gets these pieces right from day one alongside a working example of showing Salesforce data.

## Solution

A minimal external-facing starter with everything already in place: the app framework, a full sign-in experience with protected private areas, a built-in Agentforce chat assistant, the public site setup, and a single example feature — Account search — that shows how the app displays Salesforce data. The sign-in and site setup are done for you so teams can focus on the customer experience, and the Account example serves as a template for building their own features.

### Core Features

- **Sign-in experience** — Login, registration, forgot/reset password, profile, and change-password screens, plus automatic sign-out after a period of inactivity.
- **Public and private areas** — Public pages stay open to anyone, while signed-in areas are protected — the right default for a public site.
- **Public site setup** — The site configuration needed to make the app available to external users out of the box.
- **App framework and navigation** — A ready-made layout with a Home page and a "page not found" screen, prepared for adding new screens.
- **Consistent design system** — A preinstalled set of interface building blocks so new screens look consistent from the start.
- **Account search example** — A complete example with a search bar, filters, sorting, and paging, plus a search results screen and a detail view. This is the template for showing Salesforce data.
- **Add-on features** — Tooling to browse and add additional prebuilt features into the app.

### Non-Goals

- Shipping a prebuilt data model — this starter deliberately includes none; teams bring their own.
- Setting up single sign-on or an outside identity provider — it uses Salesforce's built-in sign-in for external sites.
- A finished application — the Account example is meant to be copied and then removed, not kept.
- Internal, employee-facing tools — use the Internal User App (B2E) starter for those.

## Target Users

Salesforce teams building customer- or partner-facing portals (self-service portals, order and status lookups, community front-ends) who want sign-in, access control, and the public site setup handled correctly from the start rather than assembled by hand.

## Org prerequisites

- Serving the app to external users requires **Experience Cloud (Digital Experiences)** to be enabled in the org, so the public site can be published.
