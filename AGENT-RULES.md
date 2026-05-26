You are building app navigation and flow based strictly on provided screenshots.

CRITICAL RULES:

1. DO NOT design UI.

However:
- You MAY add minimal temporary UI (buttons or touchable elements)
- Only to trigger navigation actions
- No styling, no colors, no layout decisions

Purpose of UI = navigation only

2. PRIORITY = FLOW LOGIC
- Your job is to understand user flow between screens
- Extract navigation patterns (tabs, modals, stacks)
- Recreate how screens are connected

3. USE SCREENSHOTS AS SOURCE OF TRUTH
- All flows must come only from /app/flow/screens
- Do not assume missing screens
- If something is unclear — make minimal safe assumption

4. FOLLOW EXISTING PROJECT STRUCTURE
- Use Expo Router
- Respect current folders: (tabs), onboarding, ride, etc.
- Do not break existing layout unless necessary

5. TABS
- Only create tabs that actually exist in screenshots
- Do not add extra tabs
- Center button (if exists) should trigger action, not navigation

6. MODALS & STACKS
- Identify which screens are modal vs push navigation
- Ride flow = separate stack (fullScreenModal if needed)
- Onboarding = separate flow before tabs

7. KEEP IT SIMPLE
- No overengineering
- No extra abstractions
- No unnecessary components

8. OUTPUT FORMAT
- Create only necessary files
- Focus on navigation (_layout.tsx, routing)
- Minimal placeholder screens if needed


9. THINK LIKE A USER FLOW ENGINE
- "User taps → goes to screen X → opens modal Y"
- That’s your job