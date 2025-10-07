# Mobile UI Improvements

## Overview
This document describes the CSS-based mobile improvements implemented to make the Ancestree app more user-friendly on mobile devices without affecting desktop users.

## Major Layout Changes on Mobile

### Desktop Layout (> 768px):
- **Horizontal layout**: Sidebar on the right (20% width)
- **Tree area**: Takes remaining space on the left
- **Header**: Full header with title, subtitle, and description

### Mobile Layout (≤ 768px):
- **Vertical layout**: Sidebar moves to the bottom
- **Tree area**: Top 60% of screen (minus header)
- **Sidebar**: Bottom 40% of screen
- **Header**: Minimal - only family name and logout button visible

## Changes Made

### 1. Added Mobile-Specific CSS Rules (`App.css`)
Added a media query targeting screens with max-width of 768px (typical mobile breakpoint):

```css
@media (max-width: 768px) {
  /* Hide user info (family name) in header */
  .mobile-hide-user-info {
    display: none !important;
  }
  
  /* Hide description in header */
  .mobile-hide-description {
    display: none !important;
  }
  
  /* Hide search bar in sidebar */
  .mobile-hide-search {
    display: none !important;
  }
  
  /* Hide instructions in sidebar when no node is selected */
  .mobile-hide-instructions {
    display: none !important;
  }
}
```

### 2. Updated AppHeader Component (`AppHeader.jsx`)
- Added `mobile-hide-user-info` class to the user info div (family name display)
- Added `mobile-hide-description` class to the description paragraph below the family name

### 3. Updated Sidebar Component (`Sidebar.jsx`)
- Added `mobile-hide-search` class to the search section container
- Added `mobile-hide-instructions` class to:
  - Person selection instructions (2 paragraphs)
  - Keyboard shortcuts help text
  - Connection rules section

## Elements Hidden on Mobile (≤768px width)

1. **Header:**
   - Description text below the subtitle

2. **Sidebar:**
   - Search bar at the top
   - Instructions when no person is selected:
     - "Select a person to edit their details"
     - "Double-click on the canvas to add a new person"
     - Keyboard shortcuts help
     - Connection rules guide

3. **Family Tree Canvas:**
   - Online users indicator (e.g., "🤝 2 online")

## Elements That Remain Visible on Mobile

- **Header:**
  - App title and subtitle
  - Family name indicator (e.g., "👨‍👩‍👧‍👦 Smith Family")
  - Logout button
- **Sidebar:**
  - Sidebar tabs (Editor, Photos, Map)
  - Auto Layout and Fit to View buttons
  - Node editor when a person is selected
  - Image gallery and map views
- **Family Tree:**
  - Main canvas and all nodes/edges

## Testing

To test the mobile view:
1. Open the app in a browser
2. Open Developer Tools (F12)
3. Toggle device toolbar (Ctrl+Shift+M or Cmd+Shift+M)
4. Select a mobile device or set viewport width to ≤768px
5. Verify that the specified elements are hidden

## Future Enhancements

Consider these additional mobile improvements:
- Adjust sidebar width for mobile devices
- Make tabs more touch-friendly with larger hit areas
- Optimize button sizes for touch interaction
- Adjust font sizes for better readability on small screens
- Consider a hamburger menu to hide/show sidebar on mobile
