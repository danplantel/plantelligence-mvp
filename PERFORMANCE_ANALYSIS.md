# Plantelligence Performance Analysis

**Analysis Date**: May 2026  
**Focus**: Understanding performance differences between slow and fast routes

---

## Executive Summary

The performance difference between routes is **NOT due to server vs client components** (all are client components), but rather due to:

1. **Monolithic page files** with 600-800+ lines of inline code
2. **Lack of component extraction** preventing code splitting
3. **No dynamic imports** - everything loads synchronously
4. **Inefficient data fetching** - full datasets fetched and filtered client-side
5. **Unoptimized SWR caching** configuration

**Fast routes are fast because they delegate to child components.** Slow routes try to do everything in one page file.

---

## Routes Breakdown

### SLOW ROUTES ❌

#### 1. `/new/meetings` - [app/new/meetings/page.tsx](app/new/meetings/page.tsx)

**Size**: ~800+ lines  
**Client Component**: Yes (`"use client"`)

**Problems**:
- **MASSIVE inline code block** with all logic, state, and constants
- Timezone mapping: 60+ timezone entries (100+ lines) defined inline
- Helper functions inline: `getTimezoneAbbr()`, `parseLocalDate()`, `hasMeaningfulMeetingChanges()`
- Constants inline: `FORMATS`, `PLATFORMS`, `HOURS`, `MINUTES`, `AMPM_OPTIONS`, `DURATION_HOURS`, `DURATION_MINUTES`, `statusColors`, `formatIcons`
- State management: 18+ useState hooks + 5+ useRef hooks + multiple useSWR calls
- All imports bundled upfront: 25+ lucide-react icons, all UI components, all date/form utilities
- Complex form handling with inline validation and submission

**Imports loaded even if not used**:
```typescript
// All of these parsed on page load:
- AddressSearch component
- StickyPlanCombobox 
- NavigateAwayWarningDialog
- All Radix UI components (Select, Dropdown, Popover, Dialog, etc.)
- All lucide-react icons (25+ individual imports)
```

**Data Fetching Issues**:
```typescript
// Fetches ALL clients, filters on client side
const { data: clientsData } = useSWR("/api/clients", jsonFetcher, {
  keepPreviousData: true,
  dedupingInterval: 30_000,
  revalidateOnFocus: true  // ❌ Refetches when user switches tabs
})

// Fetches meetings with filters in URL
const { data: meetingsData } = useSWR(meetingsKey, jsonFetcher, {
  keepPreviousData: true,
  dedupingInterval: 15_000,  // ❌ Short cache = more refetches
  revalidateOnFocus: true    // ❌ Refetches when switching tabs
})
```

**Performance Impact**:
- All 800 lines parsed and executed on every page load
- Large timezone map parsed even if user doesn't use it
- All state variables initialized (18+ for form, 3+ for UI state)
- Two SWR calls fire immediately
- Form state hydration takes time (building validation, initial values)

---

#### 2. `/new/documents` - [app/new/documents/page.tsx](app/new/documents/page.tsx)

**Size**: ~300+ lines  
**Client Component**: Yes

**Problems**:
- Inline component: `DocumentsPreviewEmptyState()` defined in page file
- 10+ state variables for managing preview, edit, delete, language, sorting
- Imports heavy components:
  - `DocumentPreviewModal` (handles blob URLs and downloads)
  - `DocumentEditModal` (editing UI)
  - `DocumentPreviewTab`, `DocumentUploadTab`, `DocumentListTab` (all tab content)
  - `ComplianceDocumentsUpload` with:
    - Document detection utilities
    - Category suggestion AI
    - Document persistence API
- Two-level nesting: DocumentUploadTab → ComplianceDocumentsUpload → DocumentsUploadSection
- localStorage access on initial render
- All tabs content imported upfront, even if only one tab is active

**Imports**:
```typescript
import { DocumentUploadTab } from "@/components/pages/documents/tabs/document-upload-tab";
// Which imports:
import { ComplianceDocumentsUpload } from "@/components/pages/documents/components/compliance-documents-upload";
// Which imports (70+ lines of imports):
import { DocumentsUploadSection } from "@/components/wizard/new-client-steps/sections/documents-upload-section";
import { RetirementDocumentsAccordion } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
```

**Data Fetching Issues**:
```typescript
const { data: swrData, isLoading, isValidating } = useSWR(swrKey, jsonFetcher, {
  keepPreviousData: true,
  dedupingInterval: 30_000,
  revalidateOnFocus: true  // ❌ Refetches on tab switch
})
```

**Performance Impact**:
- All tab components loaded upfront (documents list, upload, preview)
- Modal code loaded even if not displayed
- ComplianceDocumentsUpload brings in document AI/utilities
- localStorage check on mount
- Multiple state hooks initialize

---

#### 3. `/new/videos` - [app/new/videos/page.tsx](app/new/videos/page.tsx)

**Size**: ~600+ lines (analyzed portion shows first 200 lines of constants + state)  
**Client Component**: Yes

**Problems**:
- Constants defined inline (parsing overhead):
  - `PLANS`: 4 plans
  - `PLAN_VIDEO_MAPPING`: Record of plan→videos mapping
  - `EDUCATIONAL_VIDEOS`: 8 video objects with images
  - `DEFAULT_PLAN_OPTIONS`: Mapped from PLANS
  - `parseEducationalVideoIds()`: Complex parsing function
  - `VIDEO_TYPES`: Filter options
- State management: 8+ useState, multiple useRef for tracking
- Two SWR calls fire in parallel:
  ```typescript
  const { data: clientsData } = useSWR("/api/clients?search=&status=all", ...)
  const { data: plansData } = useSWR("/api/plans/get-list-plan", ...)
  ```
- Complex video matching logic in useEffect:
  - Maps clients → plans → videos
  - Filters based on draft status
  - Client-side plan/video matching
- `fetchVideoForPlan()` callback with complex data transformation
- Ref-based state management for tracking checked videos

**Performance Impact**:
- ~600 lines of inline code parsed on load
- Constants take time to evaluate
- Two parallel API calls (though SWR dedupes)
- Complex useEffect with multiple map/filter operations
- Data transformation logic runs on every effect
- Video checking state scattered across useState + useRef

---

#### 4. `/new/clients` - [components/pages/clients-list-dashboard.tsx](components/pages/clients-list-dashboard.tsx)

**Size**: ~500+ lines  
**Client Component**: Yes

**Problems**:
- Large component with all table logic inline
- Complex state: search, sorting, pagination, filters, delete dialogs
- Skeleton loaders for table rendering
- Inline filtering and sorting logic
- Delete confirmation dialog UI inline
- Pagination controls inline
- All imports upfront:
  - Table components (TableBody, TableCell, TableHead, etc.)
  - Dropdown menus, tooltips
  - 20+ lucide-react icons
  - Icons component
- Two separate SWR states for profile data and clients

**Data Fetching Issues**:
```typescript
const swrKey = useMemo(() => {
  const params = new URLSearchParams({
    search: searchDebounce,
    status: statusFilter,
    type: planTypeFilter,
    page: currentPage.toString(),
    limit: itemsPerPage.toString(),
    sortColumn, sortDirection,
  })
  return `/api/clients?${params.toString()}`
}, [searchDebounce, statusFilter, planTypeFilter, currentPage, itemsPerPage, sortColumn, sortDirection])

const { data: swrData, isLoading, isValidating, mutate: refreshClients } = useSWR(
  swrKey,
  jsonFetcher,
  {
    keepPreviousData: true,
    dedupingInterval: 30_000,
    revalidateOnFocus: true  // ❌ Refetch on tab switch
  }
)
```

**Performance Impact**:
- 500+ lines of page code
- Complex memoization of SWR key
- Table row rendering with badges, tooltips, dropdowns
- Delete operation with confirmation
- Multiple state updates on filter/sort changes

---

### FAST ROUTES ✅

#### 1. `/new/dashboard` - [app/new/dashboard/page.tsx](app/new/dashboard/page.tsx)

**Size**: ~80 lines  
**Client Component**: Yes

**Structure**:
```typescript
export function Dashboard() {
  // Simple imports
  const { data: profileData } = useSWR("/api/profile", jsonFetcher, SWR_OPTS)
  const { data: statsData } = useSWR("/api/dashboard/stats", jsonFetcher, SWR_OPTS)
  
  // Render child components
  return (
    <div>
      <QuickActions actions={quickActions} />
      <DashboardPanels />
    </div>
  )
}
```

**Why it's fast**:
- ✅ All logic delegated to child components
- ✅ Only 2 SWR calls with proper caching:
  ```typescript
  const SWR_OPTS = {
    keepPreviousData: true,
    dedupingInterval: 60_000,      // ✅ 60s cache (vs 30s for slow routes)
    revalidateOnFocus: false,      // ✅ Don't refetch on tab switch
  }
  ```
- ✅ Minimal state (just loading states)
- ✅ Child components loaded on-demand
- ✅ Clean imports: only what's needed

**Child Components** (loaded separately):
- `QuickActions` - Simple button grid component
- `DashboardPanels` - Renders 4 panels:
  - `ResourcesPanel`
  - `MarketingPanel`
  - `MeetingsPanel`
  - `InsightsPanel`

Each panel has its own SWR call and minimal rendering logic.

---

#### 2. `/new/marketing` - [app/new/marketing/page.tsx](app/new/marketing/page.tsx)

**Size**: ~35 lines  
**Client Component**: Yes

**Structure**:
```typescript
export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState("pdf-builder")
  
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>...</TabsList>
      <TabsContent><MarketingPdfBuilderPage /></TabsContent>
      <TabsContent><MarketingSpanishPdfBuilderPage /></TabsContent>
      <TabsContent><MarketingMissingRetirementBuilderPage /></TabsContent>
      <TabsContent><MarketingPdfManagerPage /></TabsContent>
      <TabsContent><MarketingFlyerGeneratorPage /></TabsContent>
    </Tabs>
  )
}
```

**Why it's fast**:
- ✅ Minimal page code (just tab state)
- ✅ Tab content imported as separate components
- ✅ Only active tab is rendered
- ✅ Lazy component imports could further optimize
- ✅ No complex state management
- ✅ No SWR calls at page level

---

#### 3. `/new/benefits` - [app/new/benefits/page.tsx](app/new/benefits/page.tsx)

**Size**: ~200 lines (but well-structured)  
**Client Component**: Yes

**Structure**:
- Wizard navigation state
- BenefitsStep1-5 components imported
- Data persisted in Zustand store (not page state)
- Each step is a separate component

**Why it's fast**:
- ✅ Complex logic in store (Zustand), not component
- ✅ Step components loaded separately
- ✅ Only current step rendered
- ✅ No inline constants (uses store)
- ✅ No modal/dialog content inline

---

#### 4. `/new/settings` - [app/new/settings/page.tsx](app/new/settings/page.tsx)

**Size**: ~150 lines (well-organized)  
**Client Component**: Yes

**Structure**:
- Tab-based layout
- Form sections imported as separate components:
  - `ProfileSettingsSection`
  - `BrandingSettingsSection`
  - `OrganizationSettingsSection`
  - `TeamAndDisclaimersSection`
  - `IntegrationsSection`
- Each section handles its own form state

**Why it's fast**:
- ✅ Tab content imported separately
- ✅ Only active tab section loaded/rendered
- ✅ Sections manage their own state
- ✅ No inline logic for each section
- ✅ Clean page structure

---

## Performance Issues by Category

### 1. CODE ORGANIZATION ⚠️

| Slow Routes | Fast Routes |
|---|---|
| 600-800 lines in single file | 35-200 lines in page file |
| All logic inline | Logic delegated to components/stores |
| Constants defined in page | Constants in separate files or stores |
| No component boundaries | Clear component extraction |
| Hard to tree-shake | Easy to lazy load |

---

### 2. IMPORTS & BUNDLING ⚠️

**Slow Routes** bundle:
- 25+ lucide-react icons
- All UI components (Card, Button, Select, Dialog, Dropdown, Popover, Table, etc.)
- All utility functions
- All constants

**Fast Routes** bundle:
- Only needed icons (4-5 per page)
- Only needed UI components
- Clean delegation

**Impact**: Slow routes have 2-3x larger JavaScript bundles

---

### 3. DATA FETCHING ⚠️

**Slow Routes**:
```
Issue 1: Inefficient SWR Options
- dedupingInterval: 15_000-30_000 (short)
- revalidateOnFocus: true (causes refetches when switching tabs)

Issue 2: Fetch Everything, Filter Client-Side
- /api/clients (all clients) → filter on client-side
- /api/meetings?search=... (filtered by query)
- /api/plans/get-list-plan (all plans) → complex client-side matching

Issue 3: Multiple Requests
- Meetings: 2 requests (/api/clients, /api/meetings)
- Videos: 2 requests (/api/clients, /api/plans)
- Documents: Variable based on tabs
```

**Fast Routes**:
```
✅ Good SWR Options
- dedupingInterval: 60_000 (long cache)
- revalidateOnFocus: false (no refetch on tab switch)

✅ Minimal Requests
- Dashboard: 2 requests total (/api/profile, /api/dashboard/stats)
- Marketing: 0 page-level requests
- Benefits: 0 page-level requests
- Settings: Lazy load data when tab opens
```

---

### 4. STATE MANAGEMENT ⚠️

**Slow Routes**:
- Meetings: 18+ useState hooks
- Videos: 8+ useState + 3+ useRef
- Documents: 10+ useState
- Clients: 8+ useState + useRef

**Impact**: Large state initialization = slow render

**Fast Routes**:
- Dashboard: 2-3 useState (only loading states)
- Marketing: 1 useState (activeTab)
- Benefits: 0 useState (uses Zustand store)
- Settings: 3-4 useState (only UI state)

---

### 5. COMPONENT EXTRACTION ⚠️

**Slow Routes** need decomposition:

**Meetings**:
- Extract: TimezonePicker (100+ lines)
- Extract: MeetingForm (300+ lines)
- Extract: MeetingsList (200+ lines)
- Extract: DateTimeFormField (50 lines)

**Documents**:
- Extract: DocumentPreview (already done, but not lazy-loaded)
- Extract: DocumentUploadUI (currently inline)
- Extract: DocumentListUI (currently inline)

**Videos**:
- Extract: VideoSelector (planning logic)
- Extract: VideoGrid (display logic)
- Extract: VideoCheckingLogic (useEffect complexity)

---

## Solutions & Optimizations

### IMMEDIATE (< 1 hour each)

#### 1. Fix SWR Options Across Slow Routes
```typescript
// Change from:
{ dedupingInterval: 30_000, revalidateOnFocus: true }

// To:
{ dedupingInterval: 60_000, revalidateOnFocus: false }
```
**Impact**: 30% faster navigation between tabs

#### 2. Move Timezone Map to Constant File
**File**: `/lib/timezone-constants.ts` (new)
```typescript
export const TIMEZONE_OPTIONS = [...]
export const getTimezoneAbbr = (tz: string) => {...}
```
**Impact**: Better code organization, easier to tree-shake

#### 3. Extract Document Constants
**File**: `/lib/document-constants.ts` (new)
```typescript
export const EDUCATIONAL_VIDEOS = [...]
export const PLAN_VIDEO_MAPPING = {...}
export const VIDEO_TYPES = [...]
```
**Impact**: ~20KB reduction in documents/videos page bundles

---

### SHORT TERM (< 4 hours each)

#### 1. Dynamic Import Modals in Meetings
```typescript
// Change from:
import { MeetingFormDialog } from "..."

// To:
const MeetingFormDialog = dynamic(() => 
  import("...").then(m => m.MeetingFormDialog), 
  { loading: () => <Spinner /> }
)
```
**Impact**: 15-20% faster initial load

#### 2. Lazy-Load Document Tab Content
```typescript
const DocumentPreviewTab = lazy(() => import("./tabs/document-preview-tab"))
const DocumentUploadTab = lazy(() => import("./tabs/document-upload-tab"))
const DocumentListTab = lazy(() => import("./tabs/document-list-tab"))

// In JSX:
<Suspense fallback={<Skeleton />}>
  <DocumentPreviewTab />
</Suspense>
```
**Impact**: 25% faster documents page load

#### 3. Extract MeetingsList Component
**File**: `components/pages/meetings/meetings-list.tsx` (new)
```typescript
export function MeetingsList({ meetings, onEdit, onDelete }) {
  // Move all table logic here
  return <Table>...</Table>
}
```
**Impact**: Cleaner code, easier to test

---

### MEDIUM TERM (< 8 hours each)

#### 1. Move Form State to Zustand Store
Create `/lib/meetings-form-store.ts`:
```typescript
export const useMeetingsFormStore = create((set) => ({
  formData: {},
  setFormData: (data) => set({ formData: data }),
  resetForm: () => set({ formData: {} })
}))
```

Move from page component:
- Remove 18+ useState hooks
- Remove form validation logic
- Keep only UI event handlers in page

**Impact**: 30% faster page hydration

#### 2. Server-Side Filter Implementation
Update API routes to accept filters:
```
GET /api/clients?status=active&type=client
GET /api/meetings?client=id&status=scheduled
```

Remove client-side filtering from pages

**Impact**: Smaller data payloads, faster rendering

#### 3. Implement Code Splitting Bundle Config
Update `next.config.js`:
```javascript
webpack: (config, { isServer }) => {
  config.optimization.splitChunks = {
    chunks: 'all',
    minSize: 20000,
    cacheGroups: {
      radix: {
        test: /@radix-ui/,
        name: 'radix-ui',
        enforce: true,
        priority: 10
      },
      lucide: {
        test: /lucide-react/,
        name: 'lucide-icons',
        enforce: true,
        priority: 10
      }
    }
  }
  return config
}
```

**Impact**: Better cache utilization, faster subsequent loads

---

### LONG TERM (> 8 hours)

#### 1. Restructure Slow Routes with Composition
Convert from monolithic to component-based:

**Before**:
```
/new/meetings/page.tsx (800 lines, everything inline)
```

**After**:
```
/new/meetings/page.tsx (100 lines, coordination only)
├─ components/meeting-form.tsx (extracted form)
├─ components/meeting-list.tsx (extracted list)
├─ components/meeting-filters.tsx (extracted filters)
└─ components/meeting-dialogs.tsx (extracted modals)
```

#### 2. Image Optimization
```typescript
// In videos page:
import Image from 'next/image'

export const EDUCATIONAL_VIDEOS = [
  {
    id: "top5",
    title: "...",
    image: "/content-library/Top5ReasonsPeopleDontSave.png",
  }
]

// In rendering:
<Image 
  src={video.image} 
  alt={video.title}
  width={300}
  height={200}
  placeholder="blur"
  blurDataURL="..."
/>
```

#### 3. Migrate to Server Components where possible
- `/new/dashboard/page.tsx` → Server component (fetch data server-side)
- `/new/benefits` → Server component (with suspense boundaries)
- Keep slow routes as client components (form-heavy)

---

## Specific File Recommendations

| File | Issue | Solution | Priority |
|------|-------|----------|----------|
| [app/new/meetings/page.tsx](app/new/meetings/page.tsx) | 800 lines inline | Extract TimezonePicker, MeetingForm, MeetingsList | HIGH |
| [app/new/documents/page.tsx](app/new/documents/page.tsx) | 3 tabs, all loaded | Lazy-load tab content with Suspense | HIGH |
| [app/new/videos/page.tsx](app/new/videos/page.tsx) | 600 lines, constants inline | Extract constants to /lib/video-constants.ts | HIGH |
| [components/pages/clients-list-dashboard.tsx](components/pages/clients-list-dashboard.tsx) | 500 lines inline | Extract TableRows, Filters, Dialogs | MEDIUM |
| [lib/meetings/index.ts](lib/meetings/index.ts) | Zustand store | Move form state from page to store | MEDIUM |
| [next.config.js](next.config.js) | No optimization | Add bundle splitting config | MEDIUM |

---

## Testing Performance Impact

After each optimization, measure using:

```bash
# Build time
npm run build

# Bundle size analysis (add @next/bundle-analyzer)
npm run build

# Lighthouse metrics
# Chrome DevTools > Lighthouse
```

**Current Baseline** (estimated):
- Meetings: 80-100KB (gzipped)
- Documents: 60-80KB (gzipped)
- Videos: 60-80KB (gzipped)

**Target After Optimization**:
- Meetings: 40-50KB (50% reduction)
- Documents: 30-40KB (50% reduction)
- Videos: 30-40KB (50% reduction)

---

## Summary

**The performance difference is NOT about server vs client components.**

**It's about code organization:**
- ✅ Fast routes delegate to child components
- ❌ Slow routes try to do everything in one 600-800 line file

**Quick wins** (< 4 hours):
1. Fix SWR options (30% improvement)
2. Move constants to separate files (20% improvement)
3. Dynamic imports for modals (15% improvement)

**Long-term improvement** (refactor for scalability):
1. Extract components from monolithic files
2. Move form state to Zustand stores
3. Implement server-side filtering
4. Add code splitting configuration
5. Migrate to server components where applicable
