# Contact Form CTA Section — Implementation Plan

## Summary
Add a "Call to Action" (CTA) section to the ContactFormSlide so the advisor can add a clickable button to the contact card that appears on the employee portal. The advisor chooses ONE type of CTA button, and the form reveals the appropriate input field based on that choice.

---

## UX Flow

```
┌─────────────────────────────────────┐
│ ☑ Add a call to action button       │  ← toggle checkbox
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Choose button type:             │ │  ← radio group (shown when toggle is on)
│ │                                 │ │
│ │ ◉ Schedule Appointment (Calendar)│ │
│ │ ○ Call                   (Phone)│ │
│ │ ○ Email                  (Mail) │ │
│ │ ○ Contact Form           (Globe)│ │
│ └─────────────────────────────────┘ │
│                                     │
│ [ Conditional input appears here ]  │  ← varies by selection
└─────────────────────────────────────┘
```

### Per-type behavior

| CTA Type | Shows | Data Used |
|----------|-------|-----------|
| **Schedule Appointment** | URL input (scheduling link) | `schedulingUrl`, `displayScheduleAppointment` |
| **Call** | Read-only display of phone with note "Uses contact phone number" | `displayPhone: true` |
| **Email** | Read-only display of email with note "Uses contact email" | `displayEmail: true` |
| **Contact Form** | URL input (custom form/contact page) | `websiteUrl`, `displayUrl` |

---

## Technical Changes

### 1. New Imports
Add `Calendar, Globe` to the existing lucide-react import.

### 2. New Form State (ContactFormSlide)
Add these state variables alongside existing ones:
```tsx
const [enableCtaButton, setEnableCtaButton] = useState(
  step3bData.enableContactButton ?? false
);
const [ctaType, setCtaType] = useState<"schedule" | "call" | "email" | "contact">(
  step3bData.ctaType || "schedule"
);
const [schedulingUrl, setSchedulingUrl] = useState(
  step3bData.schedulingUrl || ""
);
const [websiteUrl, setWebsiteUrl] = useState(
  step3bData.websiteUrl || ""
);
```

### 3. Auto-save Integration
Add `enableCtaButton`, `ctaType`, `schedulingUrl`, `websiteUrl` to the `saveStepDataLocally("step3b", ...)` call in the auto-save `useEffect` (line ~367).

### 4. saveContact Integration
In the `saveContact` callback, include the new fields in the contact object:
- When CTA is enabled: `enableContactButton: true`
- `contactButtonType`: maps `ctaType` to `"calendar" | "phone" | "email" | "url"`
- Set appropriate display flags (`displayScheduleAppointment`, `displayEmail`, `displayPhone`, `displayUrl`)
- Set the appropriate URL (`schedulingUrl` or `websiteUrl`)

### 5. CTA Section UI (inside CardContent, before closing `</CardContent>`)
Add AFTER the Company Name field (around line 1034):
- Styled separator line
- Checkbox: "Add a call to action button"
- When checked, show radio group with 4 options (compact buttons, same style as Contact Type selector)
- Conditional input based on selected type

### 6. ContactCardPreview Update
Add a button preview at the bottom of the card (below the divider, after phone/email):
- Only shown when `enableCtaButton` is true
- Shows the appropriate button text and icon based on `ctaType`
- Button styled with the `accentColor`

---

## Edge Cases to Handle

1. **ctaType reset when contactType changes**: No — CTA type is independent of individual/team type
2. **Inheriting data when editing existing contact**: Already handled by the reset `useEffect` that reads from `step3bData`
3. **Call/Email options show empty phone/email**: Show a warning hint: "Complete the Phone/Email fields above first"
4. **Invalid URL**: No validation needed on CTA URLs (optional field)
5. **Preview card too tall**: The sticky positioning already handles this

---

## Files Modified
- `components/wizard/new-client-steps/step-3-key-contacts/slides/contact-form-slide.tsx` — main changes
- No other files need changes (the `KeyContact` type already supports all needed fields: `enableContactButton`, `contactButtonType`, `schedulingUrl`, `websiteUrl`, `displayScheduleAppointment`, `displayUrl`)
