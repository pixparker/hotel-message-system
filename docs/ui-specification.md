# UX / UI Specification – Guest Messaging System (Prototype)

---

## 🎯 Objective

Design a **simple, fast, and intuitive interface** that allows hotel staff to send WhatsApp messages to current guests in under 30 seconds.

The prototype must feel **real, premium, and demo-ready**.

---

## 👤 Target User

Hotel reception staff (non-technical users)

---

## 🧠 Core Design Principles

1. Simplicity over complexity
2. Fast actions (under 30 seconds)
3. Clear step-by-step flow
4. Reduce risk (preview + test)
5. No unnecessary typing

---

## 🔐 1. Login Screen (NEW – Important for First Impression)

### Purpose:

Create a strong, professional first impression

### Elements:

* Logo (Reform Hotel or product name)
* Email field
* Password field
* Button: **Login**

### Design:

* Clean, minimal
* Premium feeling
* Optional subtle background (hotel style)

---

## 🏠 2. Dashboard (Home)

### Elements:

* Button: **Send Message (Primary CTA)**
* Button: **Check-in Guest**
* Button: Manage Guests
* Button: Reports

Optional:

* Active guests count
* Last campaign summary

---

## 👥 3. Check-in / Check-out Flow (NEW – Critical)

### Check-in (Fast Flow)

#### Screen / Modal:

* Name
* Phone number
* Preferred language

Button: **Check-in**

⏱ Target: < 10 seconds

---

### Check-out

Inside guest list:

* Button: **Check-out** (one click)

No forms, no friction

---

## ✉️ 4. Send Message Flow (Wizard – Step by Step)

### Step 1: Message Type

* Select template
* OR write custom message

---

### Step 2: Multi-language Message

* Tabs or dropdown for languages
* Example:

  * English
  * Turkish
  * Persian

System sends based on guest language

---

### Step 3: Recipients (Default Filter)

* Default: current checked-in guests
* Show:

  * “45 guests selected”

Button: View full list

---

### Step 4: Test Message

* Saved test number (editable)
* Button: **Send Test**

Important:

* Number should be saved (no retyping every time)

---

### Step 5: Final Send

* Button: **Send to Guests**
* Confirmation modal

---

### Step 6: Live Sending Status (NEW – Important)

After sending:

Show live progress:

* Sending...
* Sent: X
* Delivered: X
* Seen: X

User can:

* Stay on page
* OR close and continue work

System continues in background

---

## 📊 5. Reports (Campaign-Based)

### Purpose:

Show overview of past message campaigns

### Reports List:

Each campaign includes:

* Title / message preview
* Date & time
* Total recipients

---

### Campaign Detail View:

For each campaign:

* Total sent
* Delivered
* Seen
* Replies

Optional:

* List of recipients + status

---

## 👥 6. Guest Management

### Table:

* Name
* Phone
* Language
* Status (Checked-in / Checked-out)

### Actions:

* Add
* Edit
* Check-out

---

## 🌍 Multi-language UX

* Templates support multiple languages
* Each guest has preferred language
* System sends correct version automatically

---

## ⚠️ Key UX Rules

* Always show recipient count
* Always allow test before send
* No long forms
* No unnecessary steps

---

## 🎬 Demo Flow (VERY IMPORTANT)

1. Login
2. Dashboard
3. Check-in a guest (fast)
4. Click Send Message
5. Select template
6. Show multi-language
7. Show recipients (e.g. 45 guests)
8. Send test
9. Send final message
10. Show live status
11. Open Reports → show campaign

---

## 🎯 Success Criteria

A staff member should:

* Understand the system instantly
* Send a message without training
* Feel confident using it

---

## 🎯 Designer Guidelines (Critical)

This project is not just about UI design. It is about creating a **high-impact demo experience**.

> This is not just a UI. This is a demo that needs to impress a hotel owner in under 2 minutes.

### Key Expectations from Design:

* The flow must be **extremely clear and self-explanatory**
* No learning curve – user should understand instantly
* Focus on **speed, clarity, and confidence**
* Avoid clutter – every element must have a purpose
* Highlight primary actions (especially "Send Message")

### Demo-Oriented Design:

* Design for a **guided demo flow**, not random navigation
* Important states must be visually clear:

  * success
  * sending
  * completed
* Use **realistic content (hotel-style messages)**
* Create a sense of a **real working product (not a mock)**

---

## 🧪 Demo Data Strategy (Very Important)

The prototype must use **realistic demo data**, such as:

* Guest names (international mix)
* Phone numbers (formatted realistically)
* Languages (EN / TR / etc.)
* Message templates (real hotel scenarios)

### Important Requirement:

The design should allow **easy replacement of demo data with real data** later.

* Avoid hardcoded UI dependencies
* Keep structure reusable
* Design components in a way that they can work with dynamic data

This ensures the prototype can quickly evolve into a real product.

---

## 🚀 Expected Output

* High-fidelity UI (Figma)
* Clickable prototype
* Demo-ready experience

---

This prototype should feel like a real product ready to use in a hotel environment.
