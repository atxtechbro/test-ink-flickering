# Ink Flickering Reproduction Test

This project is a minimal reproduction case for the screen flickering issue reported in [anthropics/claude-code#769](https://github.com/anthropics/claude-code/issues/769).

## The Issue

When Claude Code processes requests, the entire terminal buffer redraws with each status update instead of just refreshing the indicator line, causing screen flickering that can be problematic for users sensitive to flashing lights.

## What This Does

This test app mimics Claude Code's rendering behavior:
- Displays conversation history (scrollable text content)
- Shows a status line with an animated spinner
- Updates the timer every 100ms (triggering frequent re-renders)
- Uses ANSI colors and formatting similar to Claude Code

## How to Run

```bash
npm install
npm start
```

## What to Watch For

1. **Screen Flickering**: Does the entire screen flash when the timer updates?
2. **Text Reappearing**: Do you see text from earlier in the session briefly flash back?
3. **Scrollback Behavior**: Does scrolling make it worse?

## Testing Different Scenarios

### Current Version (Official Ink)
```bash
npm start
```

### With OSC133 Sequences (Coming Soon)
```bash
npm run start:osc133
```

## Terminal Compatibility

Test this on different terminals to compare behavior:
- GNOME Terminal
- Kitty (has OSC133 support)
- iTerm2 (macOS)
- Windows Terminal
- tmux
- VS Code integrated terminal

## Related Links

- Original Issue: https://github.com/anthropics/claude-code/issues/769
- Ink Library Fork PR: https://github.com/bcherny/ink/pull/8
- OSC133 Documentation: Search for "OSC 133 shell integration"

## Next Steps

1. Confirm flickering reproduces in this minimal app
2. Compare with Claude Code's behavior
3. Test with OSC133 sequences added
4. Try bcherny's Ink fork
5. Profile rendering to understand the issue
