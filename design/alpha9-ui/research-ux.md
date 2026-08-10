## UI Pro Max Search Results
**Domain:** ux | **Query:** mobile progressive disclosure form loading feedback fullscreen orientation back behavior touch targets
**Source:** ux-guidelines.csv | **Found:** 12 results

### Result 1
- **Category:** Touch
- **Issue:** Touch Spacing
- **Platform:** Mobile
- **Description:** Adjacent touch targets need adequate spacing
- **Do:** Minimum 8px gap between touch targets
- **Don't:** Tightly packed clickable elements
- **Code Example Good:** gap-2 between buttons
- **Code Example Bad:** gap-0 or gap-1
- **Severity:** Medium

### Result 2
- **Category:** Responsive
- **Issue:** Touch Friendly
- **Platform:** Web
- **Description:** Mobile layouts need touch-sized targets
- **Do:** Increase touch targets on mobile
- **Don't:** Same tiny buttons on mobile
- **Code Example Good:** Larger buttons on mobile
- **Code Example Bad:** Desktop-sized targets on mobile
- **Severity:** High

### Result 3
- **Category:** Navigation
- **Issue:** Back Button
- **Platform:** Mobile
- **Description:** Users expect back to work predictably
- **Do:** Preserve navigation history properly
- **Don't:** Break browser/app back button behavior
- **Code Example Good:** history.pushState()
- **Code Example Bad:** location.replace()
- **Severity:** High

### Result 4
- **Category:** Touch
- **Issue:** Haptic Feedback
- **Platform:** Mobile
- **Description:** Tactile feedback improves interaction feel
- **Do:** Use for confirmations and important actions
- **Don't:** Overuse vibration feedback
- **Code Example Good:** navigator.vibrate(10)
- **Code Example Bad:** Vibrate on every tap
- **Severity:** Low

### Result 5
- **Category:** Forms
- **Issue:** Submit Feedback
- **Platform:** All
- **Description:** Confirm form submission status
- **Do:** Show loading then success/error state
- **Don't:** No feedback after submit
- **Code Example Good:** Loading -> Success message
- **Code Example Bad:** Button click with no response
- **Severity:** High

### Result 6
- **Category:** Touch
- **Issue:** Touch Target Size
- **Platform:** Mobile
- **Description:** Small buttons are hard to tap accurately
- **Do:** Minimum 44x44px touch targets
- **Don't:** Tiny clickable areas
- **Code Example Good:** min-h-[44px] min-w-[44px]
- **Code Example Bad:** w-6 h-6 buttons
- **Severity:** High

### Result 7
- **Category:** Touch
- **Issue:** Pull to Refresh
- **Platform:** Mobile
- **Description:** Accidental refresh is frustrating
- **Do:** Disable where not needed
- **Don't:** Enable by default everywhere
- **Code Example Good:** overscroll-behavior: contain
- **Code Example Bad:** Default overscroll
- **Severity:** Low

### Result 8
- **Category:** Animation
- **Issue:** Loading States
- **Platform:** All
- **Description:** Show feedback during async operations
- **Do:** Use skeleton screens or spinners
- **Don't:** Leave UI frozen with no feedback
- **Code Example Good:** animate-pulse skeleton
- **Code Example Bad:** Blank screen while loading
- **Severity:** High

### Result 9
- **Category:** Feedback
- **Issue:** Loading Indicators
- **Platform:** All
- **Description:** Show system status during waits
- **Do:** Show spinner/skeleton for operations > 300ms
- **Don't:** No feedback during loading
- **Code Example Good:** Skeleton or spinner
- **Code Example Bad:** Frozen UI
- **Severity:** High

### Result 10
- **Category:** Touch
- **Issue:** Tap Delay
- **Platform:** Mobile
- **Description:** 300ms tap delay feels laggy
- **Do:** Use touch-action CSS or fastclick
- **Don't:** Default mobile tap handling
- **Code Example Good:** touch-action: manipulation
- **Code Example Bad:** No touch optimization
- **Severity:** Medium

### Result 11
- **Category:** Touch
- **Issue:** Gesture Conflicts
- **Platform:** Mobile
- **Description:** Custom gestures can conflict with system
- **Do:** Avoid horizontal swipe on main content
- **Don't:** Override system gestures
- **Code Example Good:** Vertical scroll primary
- **Code Example Bad:** Horizontal swipe carousel only
- **Severity:** Medium

### Result 12
- **Category:** Accessibility
- **Issue:** Form Labels
- **Platform:** All
- **Description:** Inputs must have associated labels
- **Do:** Use label with for attribute or wrap input
- **Don't:** Placeholder-only inputs
- **Code Example Good:** <label for='email'>
- **Code Example Bad:** placeholder='Email' only
- **Severity:** High
