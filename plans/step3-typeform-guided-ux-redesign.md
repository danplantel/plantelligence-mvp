# Step 3 Key Contacts - TypeForm + Guided UX Redesign

## Current State Analysis

### Current Workflow (Sequential Sub-Steps)

```
step3a ──→ step3b ──→ step3c ──→ step3b ──→ step3d
(Category    (Contact    (Another     (Contact    (Preview/
 Selection)   Form)       Category     Form)       Layout)
                          Selection)
```

### Current Pain Points

1. **Duplicated category selection** - [`step-3a.tsx`](components/wizard/new-client-steps/step-3-key-contacts/step-3a.tsx) and [`step-3c.tsx`](components/wizard/new-client-steps/step-3-key-contacts/step-3c.tsx) are ~90% identical category grids, leading to maintenance overhead
2. **Complex sub-step routing** - The parent [`step-3-key-contacts.tsx`](components/wizard/new-client-steps/step-3-key-contacts/step-3-key-contacts.tsx) manages 4 sub-steps with custom event dispatching (`navigateToStep3a`, `selectContact`, `showIncompleteCategoriesModal`), refs for mount keys, and complex `useEffect` chains for synchronization
3. **Forced Company/Plan Sponsor first** - The current logic forces Company/Plan Sponsor as the only selectable category until one exists, but this isn't visually obvious to the user - other cards appear disabled with 58% opacity but no clear explanation
4. **No within-step progress indicator** - Users don't know how many steps remain within Step 3
5. **All categories shown at once** - Overwhelming for first-time users who just want to add their main contact

---

## Proposed Design: TypeForm + Guided UX

### Design Principles

1. **One thing at a time** - Each screen has a single, clear goal (TypeForm principle)
2. **Guided first, flexible after** - First contact setup is guided step-by-step; subsequent contacts are self-service
3. **Smooth transitions** - Use [`framer-motion`](package.json:63) `AnimatePresence` for slide transitions (already installed v11.18.2)
4. **Progress visibility** - Show slide progress within the step
5. **Consolidate duplicate code** - Merge step3a and step3c into a single reusable `CategoryGrid` component

---

### New Flow Structure (3 Phases, 4 Slides)

```
[PHASE 1: GUIDED FIRST CONTACT]
  Slide 1: "Who's your main point of contact?"  ──→  Slide 2: "Enter contact details"
  (Company/Plan Sponsor highlighted)                   (Simplified form, name/email/phone/title)

[PHASE 2: CATEGORY EXPLORER]
  Slide 3: "Do employees need different contacts for specific benefits?"
  (Category grid with status badges; click to add contacts inline)

[PHASE 3: REVIEW]
  Slide 4: Preview & Arrange (existing step3d)
```

---

### Screen-by-Screen Wireframes

#### Slide 1: First Contact Prompt
```
┌────────────────────────────────────────────┐
│ ○ ○ ○ ○  3 of 5 · Key Contacts             │  ← Stepper + progress
│                                            │
│         Who's the main point of            │
│         contact for [Company]'s            │  ← Large TypeForm-style question
│         benefits plan?                     │
│                                            │
│    ┌──────────────────────────────────┐   │
│    │                                  │   │
│    │   Company / Plan Sponsor         │   │  ← Single prominent card
│    │   ┌──────────────────────┐       │   │     (auto-selected with check)
│    │   │   [Company Logo]     │       │   │
│    │   └──────────────────────┘       │   │
│    │   This is typically the HR      │   │
│    │   representative or benefits    │   │
│    │   manager at your company.      │   │  ← Helpful context text
│    │                                  │   │
│    └──────────────────────────────────┘   │
│                                            │
│              [ Continue → ]                │  ← Large CTA button
└────────────────────────────────────────────┘
```

#### Slide 2: Contact Details (Guided)
```
┌────────────────────────────────────────────┐
│ ○ ● ○ ○  3 of 5 · Key Contacts             │
│                                            │
│         Tell us about your primary         │
│         point of contact                   │
│                                            │
│    First Name     ┌──────────────────┐    │
│                   │                  │    │
│    Last Name      ┌──────────────────┐    │
│                   │                  │    │
│    Email          ┌──────────────────┐    │
│                   │                  │    │
│    Phone          ┌──────────────────┐    │
│                   │                  │    │
│    Job Title      ┌──────────────────┐    │
│                   │                  │    │
│                                            │
│    ☐ Mark as primary contact               │  ← Toggle, default checked
│                                            │
│         [← Back]    [Continue →]           │
└────────────────────────────────────────────┘
```

#### Slide 3: Category Explorer
```
┌────────────────────────────────────────────┐
│ ○ ○ ● ○  3 of 5 · Key Contacts             │
│                                            │
│    Great! Now add contacts for specific    │
│    benefit categories (optional)           │
│                                            │
│    ┌──────────┐ ┌──────────┐              │
│    │ 🏢      │ │ 🛡️      │              │
│    │Retirement│ │  Group   │              │
│    │          │ │  Health  │              │
│    │  2 ✅   │ │  0 ⚠️   │  ← Status     │
│    │          │ │          │     badges    │
│    └──────────┘ └──────────┘              │
│    ┌──────────┐ ┌──────────┐              │
│    │ ❤️      │ │ 🎁      │              │
│    │  Group   │ │  Other   │              │
│    │  Life    │ │  Benefits│              │
│    │  1 ✅   │ │  0 ⚠️   │              │
│    │          │ │          │              │
│    └──────────┘ └──────────┘              │
│                                            │
│    Click any category to add a contact     │
│                                            │
│         [Back]    [Continue →]             │
└────────────────────────────────────────────┘
```

When a category is clicked on Slide 3, the contact form (Slide 2) slides back in with the category pre-filled. After saving, it returns to Slide 3 with the updated status.

#### Slide 4: Preview & Arrange (Existing step3d - unchanged)
Preserved as-is - see [`step-3d.tsx`](components/wizard/new-client-steps/step-3-key-contacts/step-3d.tsx)

---

### Component Architecture

```
NewClientStep3 (step-3-key-contacts.tsx - REFACTORED)
│
├── SlideContainer (new wrapper)
│   ├── AnimatePresence (framer-motion)
│   │   ├── Slide 1: <FirstContactPrompt />
│   │   ├── Slide 2: <ContactFormSlide mode="guided" />
│   │   ├── Slide 3: <CategoryExplorer />
│   │   │   ├── <CategoryGrid /> (extracted from step3a + step3c)
│   │   │   └── <ContactFormSlide mode="inline" /> (reused)
│   │   └── Slide 4: <NewClientStep3d /> (existing, preserved)
│   │
│   └── ProgressDots (new - "○ ● ○ ○" style indicator)
│
└── IncompleteCategoriesModal (preserved, used for validation)
```

### New Files to Create

| File | Purpose | Derives From |
|------|---------|-------------|
| `step-3-key-contacts/slides/first-contact-prompt.tsx` | Slide 1: Company/Plan Sponsor intro card | New |
| `step-3-key-contacts/slides/contact-form-slide.tsx` | Slide 2 + Slide 3 inline: Reusable contact form | [`step3b`](components/wizard/new-client-steps/step-3-key-contacts/step-3b.tsx) (simplified) |
| `step-3-key-contacts/slides/category-explorer.tsx` | Slide 3: Category grid with status badges | Merged [`step3a`](components/wizard/new-client-steps/step-3-key-contacts/step-3a.tsx) + [`step3c`](components/wizard/new-client-steps/step-3-key-contacts/step-3c.tsx) |
| `step-3-key-contacts/slides/slide-container.tsx` | Slide transition wrapper + progress dots | New |
| `step-3-key-contacts/components/category-grid.tsx` | Reusable category card grid | Extracted from step3a/step3c |

### Files to Modify

| File | Changes |
|------|---------|
| [`step-3-key-contacts.tsx`](components/wizard/new-client-steps/step-3-key-contacts/step-3-key-contacts.tsx) | Replace sub-step routing with slide system; remove custom event dispatching; consolidate `useEffect` chains |
| [`step-3a.tsx`](components/wizard/new-client-steps/step-3-key-contacts/step-3a.tsx) | Extract `CategoryGrid`; simplify to just the guided first-contact flow |
| [`step-3c.tsx`](components/wizard/new-client-steps/step-3-key-contacts/step-3c.tsx) | Remove entirely - functionality merged into CategoryExplorer |
| [`step-3b.tsx`](components/wizard/new-client-steps/step-3-key-contacts/step-3b.tsx) | Extract simplified contact form into `ContactFormSlide`; keep advanced editor for preview tab |
| [`new-client-wizard-store.ts`](lib/new-client-wizard-store.ts) | Add `step3SlideIndex` to state (replaces `step3SubStep`); keep backward compat |
| [`new-client-wizard-validation-v2.ts`](lib/new-client-wizard-validation-v2.ts) | Update validation to work with new slide-based state |
| [`wizard-stepper.tsx`](components/wizard/wizard-stepper.tsx) | Update editor button detection for new slide structure |

---

### Data Flow Changes

#### Store State
```typescript
// NEW: replaces step3SubStep routing
step3SlideIndex: number; // 0-3

// PRESERVED: contact form data (step3b)
step3b: Step3bData;

// NEW CONSOLIDATED: replaces step3a + step3c
step3CategoryData: {
  benefitsCategory: BenefitsCategory | null;
  otherBenefitsText?: string;
  planSponsorCompanyName?: string;
  planSponsorCompanyLogo?: string;
  otherBenefitsCompanyName?: string;
  otherBenefitsCompanyLogo?: string;
};

// PRESERVED: key contacts
keyContacts: KeyContactsData;
```

#### Slide Transition Logic
```typescript
// Simplified - no more custom events or mount keys
const handleNext = () => {
  if (slideIndex === 0 && !hasCompanyContact) {
    // Auto-select Company/Plan Sponsor, transition to form
    setSlideIndex(1);
  } else if (slideIndex === 1) {
    // Save contact, transition to category explorer
    saveContact();
    setSlideIndex(2);
  } else if (slideIndex === 2) {
    // Transition to preview
    setSlideIndex(3);
  }
};
```

---

### Transition Animations

Using `framer-motion` `AnimatePresence` with slide direction:

```typescript
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};
```

---

### Migration & Backward Compatibility

1. **Existing drafts** - When loading a draft with legacy `step3SubStep`, map to the appropriate `step3SlideIndex`:
   - `step3a` → slide 0 (or 1 if no contacts exist)
   - `step3b` → slide 1 (or 2 for additional contacts)
   - `step3c` → slide 2
   - `step3d` → slide 3

2. **Data format** - The underlying `keyContacts` data structure remains unchanged; all persisted contact data stays compatible

3. **Gradual rollout** - The new component can be feature-flagged if needed

---

### Validation Considerations

The validation logic in [`new-client-wizard-validation-v2.ts`](lib/new-client-wizard-validation-v2.ts) currently validates based on `step3SubStep`. This will need to be updated to validate based on `step3SlideIndex`:

- **Slide 0** : No validation needed (just guiding user)
- **Slide 1** : Validate contact form fields (same as current step3b validation)
- **Slide 2** : No mandatory validation (categories are optional); check at least one contact exists
- **Slide 3** : Validate preview state (same as current step3d)

---

## Implementation Steps (Todo)

1. **Create `/slides/` directory** and component scaffold
2. **Extract `CategoryGrid`** from step3a/step3c into reusable component
3. **Create `CategoryExplorer`** slide component
4. **Create `FirstContactPrompt`** slide component
5. **Create `ContactFormSlide`** simplified contact form component
6. **Create `SlideContainer`** with AnimatePresence transitions
7. **Refactor `step-3-key-contacts.tsx`** to use slide system
8. **Update store** with `step3SlideIndex` + backward compatibility
9. **Update validation** to work with new slide state
10. **Remove `step-3c.tsx`** (functionality merged)
11. **Simplify `step-3a.tsx`** (used as fallback for legacy drafts)
12. **Update wizard-stepper.tsx** editor button detection
13. **Test** all navigation paths and backward compatibility with existing drafts
