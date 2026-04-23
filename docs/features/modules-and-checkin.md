# Feature Specification – Modules System & Check-In Automation

---

## 1. Purpose of This Feature

This feature introduces a **Modules system** to the product so that the platform can stay simple at its core while becoming more customizable for different businesses.

### Core Product Remains

The core product remains:

* audience selection
* message sending
* templates
* reporting
* better customer communication through WhatsApp

### Purpose of Modules

Modules allow the platform to be extended in a controlled way.
A module can be enabled or disabled for a workspace and may add:

* settings
* UI sections
* workflows
* automations
* integration behavior

This creates a flexible foundation for future growth without making the MVP too heavy.

---

## 2. Product Evaluation

### Does this idea add value?

Yes. It adds real value.

Why:

1. It makes the platform more customizable
2. It supports different business use cases without cluttering the base product
3. It creates a clean path for future integrations and vertical-specific features
4. It aligns well with SaaS product design patterns

### Is this common in software products?

Yes.
This is a common approach in modern SaaS products, usually presented as:

* modules
* add-ons
* plugins
* apps
* extensions

Examples in the industry:

* CRM extensions
* e-commerce apps/plugins
* marketing automation add-ons
* POS integrations
* booking/hospitality extensions

### Is it recommended now?

Yes, but only in a **light MVP form**.

Important:
We should introduce the **concept and structure** of modules now, but not overbuild a full plugin architecture yet.

---

## 3. Strategic Recommendation

### Recommended Product Direction

Add a lightweight **Modules area** to the product.

In this first phase:

* modules can be shown in UI
* a module can have enabled/disabled state
* one initial module exists: **Check-In**
* Check-In module adds settings and automation behavior

### What not to do yet

Do not build:

* a complex third-party plugin runtime
* external module marketplace
* dynamic code loading
* deep module dependency system

For now, “module” should be a controlled first-party product capability that can be turned on or off per workspace.

---

## 4. Modules System – Product Definition

### Module Definition

A module is an optional product capability that can extend the base system.

Each module may define:

* name
* description
* icon
* status (installed / not installed / enabled / disabled)
* settings section
* optional navigation entries
* optional automation behavior

### Initial Module States

Suggested states for MVP:

* Available
* Installed
* Enabled
* Disabled

For the first version, “installed” and “enabled” may behave the same if needed.

---

## 5. First Module: Check-In Module

### Purpose

The Check-In module is the first hospitality-focused extension.
Its purpose is to support guest-related automated messaging around check-in and check-out events.

### Important Scope Rule

The Check-In module is introduced in two phases:

#### Phase A – Immediate Product/UI Introduction

* module is visible in the Modules page
* module can show as installed
* settings are visible in the Settings area
* no external integration required yet

#### Phase B – Functional Behavior

* module settings become active
* automatic messaging is triggered on check-in / check-out events
* future integration with hotel systems can trigger those events automatically

### Required Functional Direction

The product must support sending automatic messages at the moment of:

* check-in
* check-out

This is part of the intended feature scope for the Check-In module and should be reflected in product design and implementation planning.

---

## 6. Why Check-In Automation Adds Value

This feature adds clear business value because it:

* reduces manual work for staff
* standardizes guest communication
* makes the business feel more responsive and professional
* turns communication into a repeatable system
* increases the practical daily value of the product

### Example business value

When a guest is checked in:

* send welcome message automatically
* send Wi-Fi information
* share reception/contact instructions

When a guest is checked out:

* send thank you message
* ask for feedback
* invite them back

This is a meaningful product extension, not just a technical feature.

---

## 7. Product Behavior – Check-In Module

### 7.1 Module Presence in UI

Add a new section in the product:

* **Modules**

The Modules page should display available modules as cards or list items.

Each module should show:

* module name
* short description
* installed/enabled status
* button or toggle for activation state

### 7.2 Initial State for MVP

For now:

* Check-In module appears as installed
* it does not yet rely on external integration
* it may not change the main workflow immediately unless settings are enabled later

This allows us to establish the module concept in the product.

---

## 8. Settings Added by Check-In Module

When the Check-In module is installed/enabled, it should add a dedicated settings area.

### Settings Structure Recommendation

In the main Settings page, there should be a **Modules** section.

Suggested structure:

* Settings

  * General
  * WhatsApp Connection
  * Modules

    * Check-In
    * future modules

### Modules Settings Area

The Modules section in Settings should allow the user to:

* see available modules
* enable/disable modules
* open module-specific settings
* configure module behavior

This means module management is not only a standalone Modules page concept, but also part of Settings.

### Suggested location for module configuration

Settings → Modules → Check-In

### Suggested settings blocks

#### A. Check-In Auto Message

* Enable / disable automatic message on check-in
* Select template for check-in message
* message is sent automatically when a check-in event happens
* Optional delay before send (future)

#### B. Check-Out Auto Message

* Enable / disable automatic message on check-out
* Select template for check-out message
* message is sent automatically when a check-out event happens
* Optional delay before send (future)

#### C. Fallback Rules

* default language behavior
* whether send should be skipped if no suitable language content exists

### MVP simplification

For MVP, enough options are:

* enable check-in message
* choose template
* enable check-out message
* choose template

---

## 9. Template Requirements for Auto Messages

Auto messages should reuse the existing template system.

### Recommendation

Do **not** create a separate template engine.
Use the same Templates module, but allow templates to be assigned to automation triggers.

### Suggested additions to template metadata

Optional fields:

* template type: campaign / automation / both
* automation trigger compatibility: check_in / check_out

For MVP, even a simpler approach is enough:

* any template can be selected for check-in/check-out automation

---

## 10. Event Model

To support this cleanly, we need to distinguish between:

### A. Campaign Messages

Triggered manually by user action

### B. Automated Messages

Triggered by a system event

Examples:

* check-in
* check-out
* future welcome delay
* future reminder automation

This distinction is important for reporting, logic, and future product expansion.

---

## 11. Reporting Design Decision

### Main Question

Should automated messages be shown separately from campaigns?

### Recommendation

Do **not** create a completely separate reporting area right now.

Instead:

* keep one unified message reporting system
* add a message origin / initiator field
* allow filtering or visual distinction between manual campaigns and automated sends

### Why this is better

1. Keeps reports simple
2. Avoids fragmented analytics
3. Makes the data model cleaner
4. Supports future automation types naturally

---

## 12. Recommended Reporting Model

### Unified reporting table

In reports, all outbound message activity can appear in one system.

Each record or campaign should include:

* message type / origin
* template name
* audience / recipient count
* sent/delivered/read status
* timestamp

### Message origin values

Suggested:

* Manual Campaign
* Automation: Check-In
* Automation: Check-Out

### UI recommendation

In reports list:

* show a tag or badge for origin
* allow filter by origin later

Examples:

* [Campaign]
* [Auto · Check-In]
* [Auto · Check-Out]

### KPI handling

Two options exist:

#### Option A – Include all outbound messages in top KPIs

This is recommended.
Because all of them represent real communication activity.

#### Option B – Only include manual campaigns in top KPIs

Not recommended for now because it makes the report logic less intuitive.

### Best recommendation

Top KPIs include all outbound messages, but the user can identify the origin of each message in details.

---

## 13. Info Bar / Activity Feedback

You mentioned showing an info bar when automation sends a message.
This is a good idea.

### Recommended behavior

When an automated message is triggered successfully, show a lightweight activity notification such as:

* Check-in message sent to John Parker
* Check-out message scheduled
* Auto message failed to send

### Design notes

* should be non-blocking
* should not interrupt primary work
* should appear as toast/notification or activity log entry

### MVP recommendation

Add simple toast feedback only if the event is triggered inside the current session/UI.
If automation is background-only, store it in logs/reports rather than relying only on live notifications.

---

## 14. Recommended MVP Scope for This Feature

### Build now

1. Modules page
2. Module card UI
3. Check-In module visible as installed/enabled
4. Settings → Modules section
5. Check-In module settings area
6. ability to enable/disable the Check-In module
7. ability to choose template for check-in and check-out auto messages
8. automatic message sending on check-in event
9. automatic message sending on check-out event
10. add message origin/type field in reporting model design

### Build later / optiona## 15. Suggested UX Flow

### Modules Page

User opens Modules page and sees:

* Check-In module
* Installed
* short explanation

### Settings Page

User opens Settings → Modules → Check-In:

* Enable check-in message
* Select template
* Enable check-out message
* Select template
* Save settings

### Functional flow

When check-in event happens:

1. system detects event
2. checks whether Check-In module is enabled
3. checks whether check-in auto message is enabled
4. finds assigned template
5. resolves recipient language
6. sends message
7. stores send result in reporting system
8. optional toast/log entry shown

When check-out event happens:

1. system detects event
2. checks whether Check-In module is enabled
3. checks whether check-out auto message is enabled
4. finds assigned template
5. resolves recipient language
6. sends message
7. stores send result in reporting system
8. optional toast/log entry shown

---

## 16.detects event

2. finds assigned automation template
3. resolves recipient language
4. sends message
5. stores send result in reporting system
6. optional toast/log entry shown

---

## 16. Suggested Data Model Direction

This is product-level guidance only.

### Module

* id
* key
* name
* description
* status

### WorkspaceModule

* workspace_id
* module_id
* installed
* enabled
* installed_at

### AutomationRule

* id
* workspace_id
* module_key
* trigger_type
* enabled
* template_id
* settings_json

### OutboundMessage

* id
* workspace_id
* origin_type
* origin_reference_id
* template_id
* contact_id
* sent_at
* delivery_status
* read_status

### Suggested origin_type values

* campaign
* auto_check_in
* auto_check_out

This data model direction helps future-proof the product without overbuilding.

---

## 17. Developer Guidance – Important Simplification

### Do not build a true plugin framework now

This feature should be implemented as a product-level modules layer, not as a dynamic code/plugin system.

### Practical implementation recommendation

* add a Modules page
* define modules in configuration/code
* allow module state per workspace
* conditionally show settings and UI sections based on enabled modules

This is enough for the product stage we are in.

---

## 18. Risks and Controls

### Risk 1 – Overengineering

Trying to build a full plugin architecture too early.

**Control:** keep modules first-party and config-driven.

### Risk 2 – Report fragmentation

Creating separate report systems for campaigns and automation.

**Control:** use one outbound reporting model with origin tagging.

### Risk 3 – UX confusion

If module settings appear before the module concept is visible.

**Control:** first establish Modules page and clear structure.

### Risk 4 – Scope explosion

Trying to implement real event automation immediately.

**Control:** separate module introduction from module execution.

---

## 19. Final Recommendation

This feature is worth adding.
It is aligned with strong SaaS product design and increases the long-term value of the platform.

### Best way to implement it now

* introduce Modules as a product concept
* add Check-In as first module
* add settings for check-in/check-out auto message templates
* keep reporting unified
* mark automated sends with origin type
* delay deep automation execution until the next step

This keeps the product elegant, extensible, and still focused.

---

# Developer Summary (Short Version)

## What is changing?

We are introducing a lightweight Modules system.
The first module is **Check-In**.

## Why?

To make the product customizable and extensible without turning the core platform into a cluttered hotel-specific tool.

## What should be built now?

1. Modules page
2. Check-In module visible as installed/enabled
3. Settings → Modules section
4. Check-In module settings area
5. Ability to enable/disable modules from Settings
6. Ability to choose templates for:

   * check-in auto message
   * check-out auto message
7. Automatic message sending when check-in happens
8. Automatic message sending when check-out happens
9. Product/data model distinction between:

   * manual campaigns
   * automated messages

## Reporting decision

Do not create a separate Auto Messages report page for now.
Keep one reporting system and distinguish message origin via a field/tag such as:

* campaign
* auto_check_in
* auto_check_out

## What should wait?

* deep hotel integration
* advanced background automation engine
* third-party plugin architecture

## Main implementation principle

Build the modules concept now.
Build real check-in/check-out message automation as part of the Check-In module.
Keep the rest lightweight and controlled.
