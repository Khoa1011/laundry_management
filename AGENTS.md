# Repository Guidance

## Project

- Laundry shop management system with a Java Spring Boot backend, Spring Security, Spring Data JPA, MySQL, and a React/TypeScript frontend.
- Primary clients are mobile browsers and Android POS devices.
- The backend already uses Maven. The Maven project is located at `backend/pom.xml`.
- Maven Wrapper files already exist at `backend/mvnw` and `backend/mvnw.cmd`.
- Do not regenerate or replace the Maven project or Maven Wrapper unless explicitly requested.
- The `frontend` directory currently has not been scaffolded.

## Working rules

- Inspect the existing architecture, conventions, and dependency boundaries before modifying code.
- Preserve existing APIs and business behavior unless the task explicitly requests a change.
- Treat `docs/BUSINESS_RULES.md` as the business-rule reference and surface uncertainty or conflicts instead of guessing.
- Never modify an existing applied database migration. Add a new migration only when a requested database change requires one.
- Never expose secrets, tokens, passwords, or sensitive configuration in code, logs, documentation, or responses.
- Keep changes within task scope. Do not modify the frontend for backend-only work.
- After backend changes, run the available backend tests and the build command supported by the repository.

## Mandatory Access-Control-First Workflow for Every Business Module

Codex and all agents must:

1. Read `.agents/skills/module-access-control-first/SKILL.md`.
2. Create or update the module permission manifest before implementing a new business module or capability.
3. Register every new permission.
4. Generate backend permission constants.
5. Generate frontend permission constants and types.
6. Add explicit default role grants.
7. Keep permissions separate from branch or tenant scope, ownership scope, and business policies.
8. Protect every backend endpoint or application-service path with an effective-permission check.
9. Protect frontend navigation, routes, pages, fields, and actions.
10. Use effective permissions returned by the backend.
11. Never derive frontend access from role names.
12. Never introduce an ADMIN role-name bypass.
13. Preserve `DENY > ALLOW > ROLE` precedence.
14. Run permission generation, validation, and generated-file synchronization checks before final module completion.
15. Treat missing permission coverage or unknown permission references as a blocking quality-gate failure.

## Mobile-first web UI rules

### Objective

The project is developed as a React Web/PWA application.

The interface must be designed in this order:

```text
Mobile
-> Tablet
-> Laptop/Desktop
-> Large screens
```

Mobile is the primary design target. It must not be treated as a scaled-down desktop interface.

Because development and testing are mainly performed in a desktop web browser, every screen must be tested using:

1. An emulated mobile viewport.
2. A tablet viewport.
3. A real desktop viewport.
4. Mouse, keyboard, and emulated touch interactions.

Do not test mobile layouts only by manually resizing the browser window to an arbitrary width.

### Mandatory principles

#### Mobile styles are the default

Unprefixed CSS and Tailwind classes must target mobile screens.

Larger breakpoints should only enhance or reorganize the layout.

Correct:

```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
```

Avoid desktop-first implementations such as:

```tsx
<div className="grid grid-cols-3 max-md:grid-cols-1">
```

Do not build a desktop interface first and then use media queries to repair it for mobile.

#### Mobile is not a smaller desktop

The structure may need to change between mobile and desktop.

Examples:

```text
Desktop table -> Mobile card list
Desktop sidebar -> Mobile bottom navigation or drawer
Desktop filter toolbar -> Mobile filter bottom sheet
Desktop two-column layout -> Mobile single-column layout or step-based flow
Desktop centered modal -> Mobile full-screen dialog or bottom sheet
```

Do not force complex desktop layouts into narrow mobile screens.

#### Complete mobile before optimizing desktop

Every screen must be implemented in this order:

```text
1. Complete the mobile layout.
2. Complete mobile interactions.
3. Test forms, touch interactions, and reduced viewport height.
4. Implement loading, empty, error, and validation states.
5. Expand the layout for tablets.
6. Optimize the desktop experience.
```

Do not begin desktop optimization while the mobile version still has:

- Horizontal overflow.
- Hidden or covered actions.
- Difficult-to-use forms.
- Oversized dialogs.
- Missing loading or error states.
- Primary actions that are difficult to reach.

### Required test viewports

Every screen must be tested at the following viewport sizes.

#### Small mobile

```text
360 x 800
```

This viewport is mandatory for detecting:

- Horizontal overflow.
- Clipped text.
- Compressed buttons.
- Narrow form controls.
- Insufficient spacing.

#### Primary mobile viewport

```text
390 x 844
```

This is the main mobile viewport for design and testing.

#### Large mobile

```text
412 x 915
```

Use this viewport to ensure that the interface does not become unnecessarily stretched or create excessive empty space.

#### Tablet

```text
768 x 1024
1024 x 768
```

Test both portrait and landscape orientations.

The tablet interface must not look like a mobile interface that has simply been enlarged.

#### Laptop

```text
1280 x 720
1366 x 768
```

These are important desktop test sizes because many real laptops have limited viewport height.

Pay special attention to:

- Headers consuming too much vertical space.
- Main content being pushed below the visible area.
- Dialogs exceeding the viewport height.
- Actions at the bottom becoming inaccessible.

#### Standard desktop

```text
1440 x 900
1920 x 1080
```

Do not stretch all content across the entire screen if doing so reduces readability.

Use appropriate maximum widths for the main content.

### Testing mobile UI in a desktop browser

When testing mobile layouts in a desktop browser, use Responsive Device Mode or an exact viewport configuration.

Do not rely only on visually resizing the browser window.

For each mobile test:

1. Set an exact viewport size.
2. Keep browser zoom at 100%.
3. Reload the page after changing the viewport if layout-related JavaScript depends on screen dimensions.
4. Test portrait and landscape when the screen contains complex data.
5. Enable touch emulation when supported.
6. Scroll from the top to the bottom of the page.
7. Open and close dialogs, drawers, and bottom sheets.
8. Focus every input field.
9. Test `Tab`, `Shift + Tab`, `Enter`, and `Escape`.
10. Test with content longer than the normal sample data.

A screen must not be considered complete based only on a static screenshot.

### Mobile layout rules

#### Single-column layout by default

Most mobile forms and business content must use a single-column layout.

```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
```

Two elements may be placed side by side on mobile only when:

- Their content is short.
- Readability is not affected.
- Touch targets remain large enough.
- Inputs do not become too narrow.

Acceptable example:

```text
Decrease button | Quantity | Increase button
```

Avoid placing these fields side by side on mobile:

```text
Full name | Phone number
Address | Notes
Total amount | Outstanding debt
```

#### Spacing

Mobile spacing must be clear without wasting screen space.

Recommended values:

```text
Spacing between form controls: 12-16 px
Spacing between sections: 20-24 px
Card padding: 16 px
Horizontal page padding: 16 px
```

Avoid excessive nested cards.

Do not use too many borders, background colors, and shadows that compete for attention.

#### Desktop content width

Desktop layouts should use the additional space without creating excessively long lines or stretched forms.

Recommended maximum widths:

```text
Main lists and tables: 1440 px
Standard forms: 960-1200 px
Reading content: 720-800 px
Form dialogs: 560-800 px
```

Simple form inputs must not stretch across the full width of a 1920 px display.

### Navigation

#### Mobile navigation

Mobile may use bottom navigation for primary modules:

```text
Dashboard
Orders
Create Order
Customers
More
```

Bottom navigation must:

- Remain fixed in the correct position.
- Provide sufficiently large touch targets.
- Clearly indicate the active destination.
- Never cover the final page content.
- Respect device safe-area insets.
- Contain no more than five primary destinations.

Page content must include enough bottom padding for the navigation height.

#### Desktop navigation

Desktop should use a sidebar or top navigation according to the existing design system.

Do not display both of the following at the same time:

```text
Desktop sidebar
+ Mobile bottom navigation
```

Desktop navigation should:

- Display full menu labels.
- Support nested menu items.
- Preserve sufficient space for the main content.
- Avoid using an unnecessarily wide sidebar.

#### Focused transaction screens

Do not display the mobile bottom navigation on focused transaction screens such as:

- Create order.
- Edit order.
- Payment.
- Return items to customer.
- Inventory counting.
- Receipt preview.
- Create income or expense transaction.
- Multi-step business workflows.

These screens should contain only:

```text
Back action
Screen title
Main content
Fixed bottom action bar
```

This reduces accidental navigation and prevents users from losing entered data.

### Buttons and touch targets

Every primary mobile action must have a touch target of at least approximately:

```text
44 x 44 px
```

Do not use a small icon as the only interactive target.

Icon buttons must have:

- An `aria-label`.
- A desktop tooltip when the meaning is not obvious.
- A hover state on desktop.
- An active state for touch interaction.
- A visible keyboard focus state.
- A disabled state when unavailable.
- A loading state when processing.

Do not place destructive actions too close to primary actions.

For example:

```text
Save Order
Cancel Order
```

must not use the same color, visual weight, or emphasis.

### Fixed action bars

Long mobile forms may use a fixed bottom action bar.

The action bar must:

- Never cover page content.
- Have a clear background.
- Use a subtle border or shadow for separation.
- Respect safe-area insets.
- Never overlap the bottom navigation.
- Behave correctly when the viewport height is reduced.
- Never create two overlapping fixed bars.

Example:

```text
Estimated total: 240,000 VND
[Create Order]
```

The page must include bottom padding equal to or greater than the fixed action bar height.

### Mobile forms

#### Input types

Use appropriate input types and virtual keyboard hints.

```tsx
<input type="tel" inputMode="tel" />
<input inputMode="decimal" />
<input type="email" inputMode="email" />
```

Do not use `type="number"` for phone numbers because it may remove the leading zero.

Currency and weight fields must support direct input. Do not require users to repeatedly press increment buttons.

#### Labels

Every input must have a clear label.

Do not use the placeholder as the only label.

Correct:

```text
Phone number
[Enter phone number]
```

Avoid:

```text
[Enter phone number]
```

#### Validation

Validation errors must appear close to the related field.

Do not rely only on a generic toast such as:

```text
Invalid data
```

Use specific messages:

```text
The phone number must contain 10 digits.
The promised return time cannot be earlier than the received time.
Weight must be greater than zero.
```

After an invalid submission, focus or scroll to the first invalid field.

#### Reduced viewport height and virtual keyboard simulation

Forms must be tested with focused inputs and reduced viewport height.

Prevent the following problems:

- The active input is hidden.
- The submit button becomes inaccessible.
- The page scrolls to an incorrect position.
- A fixed footer overlaps the visible content.
- A dialog extends outside the viewport.

Desktop browser emulation cannot fully reproduce a mobile virtual keyboard. Use this reduced viewport to approximate the available space:

```text
390 x 600
```

#### Unsaved data

Important forms must warn users before leaving when unsaved changes exist.

This applies to:

- Create order.
- Edit order.
- Payment.
- Inventory count.
- Purchase or stock document.
- Income or expense transaction.

Do not show the warning when the form has not actually changed.

### Lists and data tables

#### Use cards on mobile

Business lists should generally use cards on mobile.

Example order card:

```text
GS-20260714-00125                 Ready for Pickup
Nguyen Minh Anh
Wash and Dry - 4.5 kg
Due: Today at 17:00
Remaining: 140,000 VND
```

Display important information first.

Do not expose every database field inside a mobile card.

#### Desktop may use tables

Desktop may use tables when users need to:

- Compare multiple records.
- Sort data.
- Apply filters.
- Select multiple records.
- Perform bulk actions.

Desktop tables must include:

- Clear column headers.
- Loading state.
- Empty state.
- Pagination.
- Appropriate text truncation.
- Tooltips or a detail view for long content.
- A sticky header for long lists when useful.

#### Do not force desktop tables into mobile

Do not use a large multi-column desktop table and require horizontal scrolling for primary mobile workflows.

Horizontal scrolling is acceptable only for data that is inherently tabular, such as:

- Permission matrices.
- Reconciliation tables.
- Multi-period reports.
- Data that must be compared by column.

When horizontal scrolling is necessary, provide a clear visual indication that more columns are available.

### Search and filters

#### Mobile

Mobile screens should normally display:

```text
Search field
Filter button
Active filter chips
```

Filters should open in a bottom sheet, drawer, or dedicated filter screen depending on complexity.

Do not consume most of the mobile viewport by placing many selects above the list.

#### Desktop

Desktop may display filters inline in a toolbar or sidebar.

When crossing responsive breakpoints:

- Preserve filter values.
- Do not reset search results.
- Do not create separate mobile and desktop filter states.
- Do not render two independent filter forms with inconsistent data.

### Modals, dialogs, and bottom sheets

#### Mobile

For long content, prefer:

```text
Full-screen dialog
or
Scrollable bottom sheet
```

Do not use a small centered modal for a long mobile form.

Mobile dialogs must:

- Fit within the viewport.
- Have a clear header.
- Have a visible close action.
- Provide an independently scrollable content area when needed.
- Lock background scrolling.
- Keep the primary action accessible.
- Never be covered by bottom navigation.

#### Desktop

Desktop may use centered dialogs.

Dialogs should use a maximum height such as:

```css
max-height: calc(100dvh - 32px);
overflow-y: auto;
```

Do not use a fixed pixel height when the content may vary.

#### Bottom sheets

Bottom sheets must:

- Have a maximum height.
- Allow internal scrolling.
- Provide a clear close action.
- Close with `Escape` on desktop.
- Avoid accidental dismissal during form entry.
- Restore focus correctly after closing.

### Hover, touch, and keyboard support

Because the application is developed and tested on the web, all components must support mouse, touch, and keyboard interaction.

Hover must never be the only way to:

- Reveal important actions.
- Display required information.
- Open a critical menu.
- Understand a status.
- Access essential tooltip content.

Hover is only an enhancement for desktop users.

Every primary action must remain available through click or touch.

Interactive elements must support:

```text
default
hover
active
focus-visible
disabled
loading
```

Test keyboard interaction with:

```text
Tab
Shift + Tab
Enter
Space
Escape
```

### Responsive behavior

Do not test only at exact breakpoint values.

Gradually resize the viewport from:

```text
360 px -> 1440 px
```

This is required to detect intermediate-width layout problems.

The interface must not exhibit:

- Unexpected layout jumps.
- Excessively wide cards.
- Large unused spaces.
- Sidebars overlapping content.
- Incorrect button wrapping.
- Header overflow.
- Missing content between breakpoints.

Breakpoints must be chosen based on layout requirements, not only device labels.

### Typography

Mobile typography must prioritize readability.

Recommended values:

```text
Primary body text: 14-16 px
Input text: at least 16 px on mobile
Screen headings: 20-24 px
Secondary labels: no smaller than 12 px
```

Mobile inputs should use a minimum font size of 16 px to reduce the risk of browser zoom on focus.

Avoid using too many font weights.

Important distinctions must not depend only on color.

### Long and abnormal data

Every screen must be tested with:

- Long customer names.
- Long service names.
- Multi-line addresses.
- Long notes.
- Large currency values.
- Empty lists.
- Hundreds of records.
- Long status labels.
- Broken images.
- Slow API responses.
- Failed API responses.

Do not test only with short and visually clean sample data.

Long text must use an appropriate strategy:

- Wrap.
- Line clamp.
- Truncate with a tooltip or detail view.
- Expandable content.

Text must never overflow its container.

### Loading, empty, error, and success states

Every data-driven screen must support:

```text
Loading
Empty
Error
Success
```

Do not show a blank screen while loading.

Do not display "No data" when the request has actually failed.

Submit buttons must show a loading state and prevent repeated submissions.

When the main transaction succeeds but a secondary action fails, the UI must reflect both outcomes accurately.

Example:

```text
Payment completed successfully.
Receipt printing failed.
```

Do not report the entire transaction as failed when only printing failed.

### Colors and status presentation

Do not use color as the only method of communicating status.

Each status must use at least:

```text
Color + Text
```

or:

```text
Color + Icon + Text
```

Examples:

```text
Ready for Pickup
Overdue
Paid
```

Success, warning, error, and neutral colors must remain consistent across the application.

Do not create new colors for individual screens when existing design tokens already cover the required meaning.

### Tailwind and CSS rules

#### Mobile-first classes

Unprefixed classes target mobile.

```tsx
className="
  grid
  grid-cols-1
  gap-4
  px-4
  py-3
  md:grid-cols-2
  lg:px-6
"
```

#### Limit arbitrary values

Do not overuse values such as:

```text
w-[347px]
mt-[13px]
left-[19px]
```

Prefer existing spacing and sizing tokens.

Use arbitrary values only when there is a clear layout requirement.

#### Avoid JavaScript viewport checks when CSS is sufficient

Do not use code such as:

```tsx
window.innerWidth < 768
```

only to control responsive layout.

Prefer CSS and responsive utility classes.

JavaScript should be used only when behavior truly differs and cannot be implemented safely with CSS.

When using `matchMedia`:

- Subscribe to viewport changes.
- Remove listeners correctly.
- Avoid hydration problems if server-side rendering is introduced.

#### Do not maintain independent mobile and desktop data flows

Avoid creating:

```tsx
<MobileOrderList />
<DesktopOrderTable />
```

when each component performs its own fetch and manages separate state.

Different visual presentations may be used, but they must share:

- Query state.
- Filter state.
- Pagination state.
- Mutations.
- Permissions.
- Business logic.

Mobile and desktop must never display inconsistent records or statuses.

### Desktop must still be optimized

Mobile-first does not mean that desktop should display enlarged mobile cards.

After mobile is complete, desktop should use the available space to:

- Display a sidebar.
- Use tables where appropriate.
- Place summaries beside the main content.
- Display filters directly.
- Reduce unnecessary navigation.
- Support keyboard-heavy workflows.
- Show more useful information without creating visual overload.

Example for an order creation screen:

```text
Mobile:
Sections or step-based form
-> Summary near the end
-> Fixed Create Order action

Desktop:
Left column: customer and service information
Right column: price summary and primary actions
```

Desktop optimization must never reduce mobile usability.

### Browser zoom testing

Important desktop screens must be tested at:

```text
100%
125%
```

This helps identify:

- Covered content.
- Oversized dialogs.
- Overflowing headers or buttons.
- Problems experienced by users with increased display scaling.

Do not reduce browser zoom below 100% merely to make a layout fit.

### Low-height viewport testing

In addition to width, test reduced viewport height:

```text
1366 x 600
390 x 600
```

This is especially important for:

- Dialogs.
- Order creation.
- Payment screens.
- Bottom sheets.
- Fixed action bars.
- Screens with both fixed headers and fixed footers.

Do not assume every device has a tall display.

### Browser compatibility

Use a Chromium-based browser as the main development environment.

Critical features must not depend on poorly supported browser APIs without an approved fallback.

Pay special attention to:

- `position: sticky`.
- `100vh` and `100dvh`.
- Overflow behavior.
- Fixed footers.
- Date and time inputs.
- Image uploads.
- Camera or QR scanning.
- PWA standalone mode.

Prefer dynamic viewport units where appropriate:

```css
min-height: 100dvh;
```

Provide a fallback when required by the supported browser range.

### Role and permission testing

Each relevant screen must be tested using at least:

- Store owner or manager.
- Employee with full access to the module.
- Employee with read-only access.
- User without access.

Frontend permission checks are not sufficient.

The backend must independently verify authorization.

The frontend must correctly handle:

```text
403 Forbidden
```

Do not show a generic system error when the actual issue is missing permission.

### Using the `impeccable` skill

When running the `impeccable` skill, audit responsive interfaces in this order:

```text
1. Mobile
2. Tablet
3. Desktop
```

The mobile audit must be completed before desktop improvements are applied.

The skill must check:

- Touch target sizes.
- One-handed usability.
- Visual hierarchy.
- Typography.
- Spacing.
- Form usability.
- Reduced viewport height.
- Fixed action bars.
- Bottom navigation overlap.
- Dialog and bottom-sheet behavior.
- Horizontal overflow.
- Long-content handling.
- Loading, empty, error, and success states.
- Accessibility.
- Keyboard navigation.
- Desktop hover behavior.
- Consistency with the existing design system.

Do not redesign the entire application unless explicitly requested.

Do not improve desktop by reducing mobile usability.

### Required responsive test process

For every new or modified screen, perform the following process:

```text
Step 1: Test at 390 x 844.
Step 2: Test at 360 x 800.
Step 3: Test at 390 x 600.
Step 4: Test at 768 x 1024.
Step 5: Test at 1024 x 768.
Step 6: Test at 1366 x 768.
Step 7: Test at 1440 x 900.
Step 8: Test desktop at 125% browser zoom.
Step 9: Resize gradually between breakpoints.
Step 10: Test loading, empty, error, and long-data states.
```

A screen is not complete until this process has been performed.

### Definition of done for a responsive screen

A screen may be marked complete only when all of the following conditions are satisfied:

- The mobile layout is implemented first.
- The screen works at 360 px width.
- There is no unintended horizontal scrolling.
- Primary actions are easy to reach.
- Touch targets are sufficiently large.
- Inputs use appropriate types and keyboard hints.
- The layout remains usable at 390 x 600.
- Bottom navigation does not cover content.
- Fixed action bars do not cover form fields.
- Dialogs fit inside the viewport.
- Long text does not break the layout.
- Loading, empty, error, and success states are implemented.
- Keyboard focus is visible.
- The screen is usable without hover.
- Tablet layout uses space appropriately.
- Desktop layout is intentionally optimized.
- Mobile and desktop share the same data and business state.
- Permission-denied responses are handled correctly.
- Frontend type checking passes.
- Frontend linting passes.
- The production build passes.
- The `impeccable` audit has no unresolved high-severity issue within the screen's scope.

### Agent implementation rules

Before modifying a screen, the agent must:

1. Inspect the existing design system and reusable components.
2. Inspect the current responsive behavior.
3. Identify the primary mobile workflow.
4. Identify the main and secondary actions.
5. Identify fixed headers, fixed footers, bottom navigation, and safe-area requirements.
6. Identify loading, empty, error, and permission states.
7. Present a short implementation plan before making changes.

While implementing:

- Start with the mobile layout.
- Reuse existing design tokens and components.
- Avoid unrelated refactoring.
- Do not introduce mock data into production flows.
- Do not duplicate mobile and desktop business logic.
- Do not remove existing functionality for visual simplification.
- Preserve Vietnamese interface content unless a separate localization requirement is provided.

After implementing:

1. Run type checking.
2. Run linting.
3. Run the production build.
4. Test the required responsive viewports.
5. Run the `impeccable` skill.
6. Fix high-impact issues within the modified scope.
7. Report the exact files changed and test results.

### Final reporting format for responsive UI tasks

After completing a responsive UI task, report:

#### A. Mobile implementation

- Mobile layout changes.
- Primary mobile workflow.
- Touch and form improvements.
- Bottom navigation or fixed action behavior.

#### B. Tablet and desktop

- Tablet layout changes.
- Desktop layout changes.
- Table, sidebar, or multi-column adaptations.

#### C. States covered

- Loading.
- Empty.
- Error.
- Success.
- Validation.
- Permission denied.
- Long content.

#### D. Responsive tests

List the tested viewport sizes and any issues found.

#### E. Quality checks

Report the results of:

- Type checking.
- Linting.
- Production build.
- `impeccable` audit.

Do not claim that a screen is complete when it has only been visually implemented without real interaction, API integration, state handling, and responsive testing.

## Handoff

Report files changed, tests run, build results, API changes, database changes, and remaining risks. State explicitly when a category has no changes or when a command could not be run.
