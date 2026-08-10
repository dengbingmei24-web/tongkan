## UI Pro Max Search Results
**Domain:** ux | **Query:** mobile light dark mode theme toggle persistence contrast neutral surfaces
**Source:** ux-guidelines.csv | **Found:** 10 results

### Result 1
- **Category:** Typography
- **Issue:** Contrast Readability
- **Platform:** All
- **Description:** Body text needs good contrast
- **Do:** Use darker text on light backgrounds
- **Don't:** Gray text on gray background
- **Code Example Good:** text-gray-900 on white
- **Code Example Bad:** text-gray-400 on gray-100
- **Severity:** High

### Result 2
- **Category:** Accessibility
- **Issue:** Color Contrast
- **Platform:** All
- **Description:** Text must be readable against background
- **Do:** Minimum 4.5:1 ratio for normal text
- **Don't:** Low contrast text
- **Code Example Good:** #333 on white (7:1)
- **Code Example Bad:** #999 on white (2.8:1)
- **Severity:** High

### Result 3
- **Category:** Forms
- **Issue:** Mobile Keyboards
- **Platform:** Mobile
- **Description:** Show appropriate keyboard for input type
- **Do:** Use inputmode attribute
- **Don't:** Default keyboard for all inputs
- **Code Example Good:** inputmode='numeric'
- **Code Example Bad:** Text keyboard for numbers
- **Severity:** Medium

### Result 4
- **Category:** Responsive
- **Issue:** Mobile First
- **Platform:** Web
- **Description:** Design for mobile then enhance for larger
- **Do:** Start with mobile styles then add breakpoints
- **Don't:** Desktop-first causing mobile issues
- **Code Example Good:** Default mobile + md: lg: xl:
- **Code Example Bad:** Desktop default + max-width queries
- **Severity:** Medium

### Result 5
- **Category:** Touch
- **Issue:** Pull to Refresh
- **Platform:** Mobile
- **Description:** Accidental refresh is frustrating
- **Do:** Disable where not needed
- **Don't:** Enable by default everywhere
- **Code Example Good:** overscroll-behavior: contain
- **Code Example Bad:** Default overscroll
- **Severity:** Low

### Result 6
- **Category:** Responsive
- **Issue:** Viewport Meta
- **Platform:** Web
- **Description:** Set viewport for mobile devices
- **Do:** Use width=device-width initial-scale=1
- **Don't:** Missing or incorrect viewport
- **Code Example Good:** <meta name='viewport'...>
- **Code Example Bad:** No viewport meta tag
- **Severity:** High

### Result 7
- **Category:** Responsive
- **Issue:** Table Handling
- **Platform:** Web
- **Description:** Tables can overflow on mobile
- **Do:** Use horizontal scroll or card layout
- **Don't:** Wide tables breaking layout
- **Code Example Good:** overflow-x-auto wrapper
- **Code Example Bad:** Table overflows viewport
- **Severity:** Medium

### Result 8
- **Category:** Navigation
- **Issue:** Back Button
- **Platform:** Mobile
- **Description:** Users expect back to work predictably
- **Do:** Preserve navigation history properly
- **Don't:** Break browser/app back button behavior
- **Code Example Good:** history.pushState()
- **Code Example Bad:** location.replace()
- **Severity:** High

### Result 9
- **Category:** Layout
- **Issue:** Viewport Units
- **Platform:** Web
- **Description:** 100vh can be problematic on mobile browsers
- **Do:** Use dvh or account for mobile browser chrome
- **Don't:** Use 100vh for full-screen mobile layouts
- **Code Example Good:** min-h-dvh or min-h-screen
- **Code Example Bad:** h-screen on mobile
- **Severity:** Medium

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
