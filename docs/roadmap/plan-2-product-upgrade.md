# Customer Messaging Platform – Product Specification

---

## 1. Product Direction

### Product Vision
A WhatsApp-first customer communication platform that helps businesses send messages quickly to the right target audience.

### Core Product Promise
**Fast message sending to the right audience group.**

### Product Positioning
The product is evolving from a hotel-only guest messaging tool into a broader **customer communication platform**.

The hotel use case remains the first real business scenario and the first production target, but the product architecture should support future use cases beyond hotels.

---

## 2. Business Goal

### Immediate Goal
Deliver a functional MVP that solves the current customer need for Reform Hotel:
- send messages quickly to hotel guests
- support additional contact groups such as friends and VIPs
- keep the workflow very simple

### Long-Term Goal
Grow the product into a reusable SaaS-ready platform that can support multiple businesses and multiple integration modules in the future.

---

## 3. Product Principles

1. Simplicity first
2. Speed of sending is a core value
3. Audience selection must be easy and flexible
4. Core workflow must stay clear and low-friction
5. Product should be architected for future expansion
6. Current customer needs come before generic platform complexity

---

## 4. Core Product Concept

The core of the product is a **campaign engine**:

> Select audience → prepare message → send via WhatsApp → track results

The platform should support different audience groups and different contact sources.

---

## 5. Key Product Concepts

### 5.1 Contact
A person who can receive messages.

Examples:
- hotel guest
- friend
- VIP guest
- returning customer

Suggested fields:
- full name
- phone number
- preferred language
- source
- tags
- active/inactive status

---

### 5.2 Contact Source
Where the contact came from.

Examples:
- Manual Entry
- Hotel Integration (Electra)
- CSV Import
- Future integrations

Important note:
Contact source and audience group are different concepts.
A contact may come from a hotel integration source and also belong to the VIP audience.

---

### 5.3 Audience / List
A group of contacts selected for messaging.

Examples:
- Hotel Guests
- Friends
- VIP
- Returning Customers
- Custom List

In MVP, this can be implemented as simple lists.
In the future, this can evolve into dynamic segments and filtering.

---

### 5.4 Campaign
A message sending action to one or more audience groups.

A campaign includes:
- selected audience(s)
- message content
- language variations
- test send
- final send
- delivery/reporting status

---

### 5.5 Template
Reusable message content for common cases.

Examples:
- Welcome message
- Live music event
- Restaurant promotion
- Service announcement

Templates can support multiple languages.

---

### 5.6 Channel Connection
The active WhatsApp connection used to send messages.

In MVP:
- one WhatsApp connection per workspace/account

In future:
- multiple channels/devices
- multiple sending identities

---

### 5.7 Integration Module
A module that syncs or imports contacts from an external system.

Examples:
- Hotel Electra module
- CSV module
- CRM module
- POS module

---

## 6. Main Use Cases

### 6.1 Hotel Use Case (Current Customer)
- send message to all current guests
- send message to VIP guests
- send message to friends/known customers
- use templates for common hotel communication
- support multiple languages
- optionally sync guests from hotel software in future

### 6.2 General Business Use Case (Future Expansion)
- send campaigns to selected customer groups
- manage contact lists
- send promotions, announcements, reminders
- use integrations as contact sources

---

## 7. Product Scope Overview

### Included in Product Scope
- contacts
- audience lists
- campaigns
- templates
- multilingual messaging
- WhatsApp connection
- reports
- integrations module concept

### Explicitly Deferred for Later
- licensing / plan limits
- advanced user permissions
- advanced automation engine
- multi-tenant production rollout
- complex segmentation builder
- advanced analytics
- multiple device management

---

## 8. Feature Inventory (Full Product Scope)

This section lists the complete intended feature set, even if implementation is deferred beyond MVP.

### 8.1 Authentication
- login screen
- secure access
- future user roles

### 8.2 Dashboard
- summary of contacts
- recent campaigns
- quick actions
- connected WhatsApp status

### 8.3 Contact Management
- add contact manually
- edit contact
- deactivate contact
- set preferred language
- assign tags
- assign to one or more lists
- import contacts from external sources

### 8.4 Audience Management
- create audience/list
- rename audience/list
- add/remove contacts
- assign audience types such as Guests, VIP, Friends
- future: dynamic filters / segments

### 8.5 Campaign Management
- create campaign
- choose one or more audiences
- review recipient count
- review recipient list
- choose template or create custom message
- multilingual message content
- default/fallback language behavior
- test send to saved test number
- final send
- live sending progress
- background processing
- campaign history

### 8.6 Templates
- create template
- edit template
- multilingual template content
- categorize templates

### 8.7 Reports
- campaign list
- campaign detail
- sent / delivered / read / failed counts
- response indicators (future)
- recipient-level status view (future)

### 8.8 WhatsApp Connection
- connect WhatsApp channel/device
- show connection status
- reconnect if disconnected
- future: multiple channels/devices

### 8.9 Integrations
- hotel integration module
- manual data entry
- CSV import
- future external systems

### 8.10 Hospitality Extensions (Future)
- auto guest sync from hotel system
- check-in / check-out synchronization
- welcome message automation
- room-related contextual messaging

### 8.11 Business Extensions (Future)
- VIP campaigns
- customer loyalty lists
- repeat visitor targeting
- promotional campaigns beyond hotel guests

---

## 9. MVP Definition (What We Build Now)

The MVP must satisfy the current customer while keeping the product direction SaaS-ready.

### 9.1 MVP Goal
Allow a business to:
- manage contacts manually
- organize them into simple audience lists
- send multilingual WhatsApp campaigns
- test before sending
- track basic delivery results

### 9.2 MVP Modules

#### A. Authentication / Access
- simple login page

#### B. Dashboard
- quick entry points
- active contacts count
- recent campaigns summary

#### C. Contacts
- add contact manually
- edit contact
- set preferred language
- assign contact to one or more lists
- basic active/inactive status

#### D. Audience Lists
- predefined lists for MVP demo and usage:
  - Hotel Guests
  - VIP
  - Friends
- ability to create basic custom lists if low effort

#### E. Campaigns
- select one or more audience lists
- show recipient count
- view recipients list
- choose template or custom message
- multilingual content
- saved test number
- send test
- final send
- live sending status UI
- campaign history

#### F. Reports
- sent / delivered / read / failed counts per campaign
- campaign detail page

#### G. WhatsApp Connection
- one connection/device only
- connection status shown in UI

#### H. Hotel Integration Placeholder
- no full integration required in MVP
- keep architecture ready for future Electra integration
- manual process remains valid for hotel use case

---

## 10. MVP Features Explicitly Out of Scope

The following should not be implemented now unless they are trivial:
- advanced rule-based filtering
- workflow automation
- multiple devices
- multiple users/roles
- licensing/plan restrictions
- multi-tenant production logic
- deep Electra integration
- inbound reply management center

---

## 11. UX Priorities for MVP

1. Fast campaign creation
2. Very easy audience selection
3. Clear multilingual message editing
4. Low-risk sending flow (test + preview)
5. Clear live status and reporting

### Core UX Promise
A user should be able to send a message to the right audience in a few simple steps with minimal training.

---

## 12. Suggested Product Structure for Development

### Suggested Main Areas
- Dashboard
- Contacts
- Audiences
- Campaigns
- Templates
- Reports
- Settings / WhatsApp Connection
- Integrations (placeholder)

---

## 13. Suggested Data Model Direction

This is not a final technical schema, only a product-level direction.

### Workspace
Represents one business/customer.

### Contact
- name
- phone
- preferred_language
- source
- status

### Tag
- label

### AudienceList
- name
- type

### ContactAudience
- contact_id
- audience_id

### Template
- name
- category

### TemplateTranslation
- language
- content

### Campaign
- name/title
- status
- created_at
- sent_at

### CampaignAudience
- campaign_id
- audience_id

### CampaignMessageTranslation
- language
- content

### CampaignRecipient
- campaign_id
- contact_id
- delivery status
- read status

### ChannelConnection
- type
- status

### Integration
- type
- status

Important note:
Even if only one customer is active now, architecture should conceptually allow a future workspace/tenant model.

---

## 14. Product Roadmap (Upgradeable)

### Phase 1 — Working MVP for Reform Hotel
- manual contacts
- predefined audience groups
- campaigns
- multilingual templates
- basic reports
- one WhatsApp connection
- real working version for practical trial

### Phase 2 — Operational Improvement
- custom lists
- CSV import
- cleaner connection management
- improved campaign reports
- improved contact organization

### Phase 3 — Vertical Readiness (Hospitality)
- Hotel Electra integration
- guest sync automation
- basic welcome message automations
- hotel-oriented workflow improvements

### Phase 4 — SaaS Foundation
- workspace-based architecture hardening
- subscription/licensing layer
- multi-tenant rollout
- admin controls
- per-workspace settings

### Phase 5 — General Business Expansion
- CRM/POS integrations
- advanced audience filtering
- customer segments
- more business-oriented campaign types

### Phase 6 — Product Expansion
- automation rules
- reply/inbox layer
- multiple channels/devices
- advanced analytics
- templates marketplace / reusable modules

---

## 15. Final Product Strategy Note

The product should be built with a broader platform mindset, but the current MVP should remain highly focused on the real needs of the current customer.

### Practical Rule
Build for today’s use case.
Design for tomorrow’s platform.

---

# Developer Summary (Short Version)

## Product Change Summary
The product is no longer only a hotel guest messaging tool.
It is now a broader **customer messaging platform** where hotel guest messaging is one important use case.

## Most Important Product Shift
We are moving from:
- one guest list

to:
- contacts
- multiple audience groups/lists
- campaigns sent to selected target groups

## What Must Change in MVP
1. Replace hotel-only guest list mindset with **Contacts + Audience Lists**
2. Support multiple audience groups such as:
   - Hotel Guests
   - VIP
   - Friends
3. Campaign sending must allow selecting one or more audience lists
4. Contacts should support preferred language
5. Keep manual contact flow working
6. Keep architecture ready for a future hotel integration module
7. Keep only one WhatsApp connection/device for now

## MVP Build Priority
1. Contacts
2. Audience Lists
3. Campaign sending flow
4. Templates + multilingual support
5. Reports
6. WhatsApp connection status

## Do Not Overbuild Now
Do not implement:
- licensing
- multi-tenant logic in full
- advanced automation
- complex filters
- multiple devices

## Main Goal for Current Iteration
Deliver a real working version that clearly shows:
- contacts can be managed
- target groups can be selected
- messages can be sent
- delivery can be tracked

This should be good enough to impress the customer and validate real product usage.
