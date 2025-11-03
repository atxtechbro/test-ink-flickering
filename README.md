# Ink Flickering Reproduction Test

This project is a minimal reproduction case for the screen flickering issue reported in [anthropics/claude-code#769](https://github.com/anthropics/claude-code/issues/769).

## The Issue

When Claude Code processes requests, the entire terminal buffer redraws with each status update instead of just refreshing the indicator line, causing screen flickering that can be problematic for users sensitive to flashing lights.

## Project Status

### Phase 1: Reproduction ✅ Complete
- Successfully reproduced Ink flickering with minimal test case
- Confirmed issue matches Claude Code behavior
- Established baseline for testing fixes

### Phase 2: Fix Testing ✅ Complete - **No Fixes Work**
Exhaustively tested all commonly suggested fixes:
- ❌ OSC133 sequences (inconclusive on GNOME, but fork with OSC133 fails)
- ❌ bcherny's Ink fork v5.0.24 (doesn't fix it)
- ❌ Ink 3.2.0 (still flickers)
- ❌ Ink 4.0.0 (still flickers)
- ❌ Ink 4.4.1 (still flickers)

**Conclusion**: Flickering is fundamental to Ink's rendering architecture across all versions.

### Phase 3: Source Code Investigation ⏳ Next
We've decided to investigate Ink's rendering engine to implement selective updates.
This is the only path forward for a universal fix that works in tmux.

📋 **See [FINDINGS.md](./FINDINGS.md) for detailed test results and investigation plan**

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

### Baseline Test (Official Ink)
```bash
npm start
```

### With OSC133 Sequences
```bash
npm run start:osc133
```
**Note**: Requires terminal with OSC133 support (Kitty, Windows Terminal, VS Code)

### Stress Test (Aggressive Rendering)
```bash
npm run stress
```
⚠️ **Warning**: Updates every 50ms - may be uncomfortable!

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

### Testing Phase ✅ Complete
1. ✅ ~~Confirm flickering reproduces in this minimal app~~
2. ✅ ~~Compare with Claude Code's behavior~~
3. ✅ ~~Test OSC133 sequences~~ (inconclusive, but fork with OSC133 fails)
4. ✅ ~~Try bcherny's Ink fork~~ (doesn't fix it)
5. ✅ ~~Test different Ink versions~~ (v3.x, v4.x, v5.x all flicker)

### Source Investigation Phase ⏳ Starting
1. Clone and analyze Ink source code
2. Study rendering engine architecture
3. Identify root cause of full redraws
4. Prototype selective update mechanism
5. Implement fix if feasible

See [FINDINGS.md](./FINDINGS.md) for detailed investigation plan.

## Documentation

- [REPRODUCED.md](./REPRODUCED.md) - Reproduction confirmation and analysis
- [FINDINGS.md](./FINDINGS.md) - Detailed test results log
- [TESTING-GUIDE.md](./TESTING-GUIDE.md) - Comprehensive testing instructions
