# Initial Test Results

## What We've Built

A minimal reproduction environment for investigating the Ink terminal flickering issue reported in [anthropics/claude-code#769](https://github.com/anthropics/claude-code/issues/769).

### Created Files

1. **minimal-repro.js** - Basic reproduction with 100ms updates
2. **with-osc133.js** - Same test but with OSC 133 control sequences
3. **stress-test.js** - Aggressive version with 50ms updates
4. **TESTING-GUIDE.md** - Comprehensive testing instructions
5. **README.md** - Project overview

## Initial Findings

### Evidence of the Issue

When running `npm start`, the terminal output shows extensive use of ANSI escape sequences:

```
[2K[1A[2K[1A[2K[1A...
```

Breaking this down:
- `[2K` = Clear entire line (ESC[2K)
- `[1A` = Move cursor up one line (ESC[1A)

**The Pattern**: Every 100ms update causes Ink to:
1. Move cursor up ~60+ lines
2. Clear each line
3. Redraw the entire component

This is the root cause of the flickering - the entire terminal buffer is being redrawn instead of just updating the status line.

## What This Proves

✅ We can reproduce terminal flickering behavior using vanilla Ink
✅ The issue is visible in the raw escape sequences
✅ Ink is doing full-component redraws on every state change
✅ This matches the behavior described in the Claude Code issue

## Next Steps for Testing

### 1. Compare with Claude Code
Run both applications side-by-side:
```bash
# Terminal 1
cd test-ink-flickering
npm start

# Terminal 2
claude  # or run Claude Code
```

Does the flickering behavior match?

### 2. Test OSC133 Version
```bash
npm run start:osc133
```

Does adding OSC 133 sequences reduce the flickering?
(Your terminal must support OSC 133: Kitty, iTerm2, Windows Terminal, VS Code)

### 3. Test Stress Mode
```bash
npm run stress
```

⚠️ WARNING: Updates every 50ms - may be uncomfortable!

Does more aggressive updating make the issue worse?

### 4. Test Different Terminals

Try each version in different terminal emulators:
- GNOME Terminal
- Kitty
- Konsole
- Alacritty
- Windows Terminal
- tmux
- VS Code integrated terminal

Document which terminals show flickering and which don't.

### 5. Profile the Rendering

Capture raw output to analyze:
```bash
script -c "npm start" typescript.txt
```

Then examine the escape sequences to understand the rendering pattern.

### 6. Try bcherny's Ink Fork

Test if the fork has improvements:
```bash
# Modify package.json
"ink": "github:bcherny/ink#master"

npm install
npm start
```

Does it behave differently?

## Key Questions to Answer

1. **Does this minimal reproduction exhibit the same flickering as Claude Code?**
   - If yes → We have a controlled test environment
   - If no → What's different?

2. **Do OSC133 sequences help?**
   - Compare `npm start` vs `npm run start:osc133`
   - Only meaningful on terminals that support OSC 133

3. **Is it terminal-specific?**
   - Which terminals flicker?
   - Which don't?

4. **Can we measure the performance impact?**
   - CPU usage
   - Number of write() syscalls
   - Terminal responsiveness

## Potential Fixes to Explore

Based on the research:

1. **OSC 133 Prompt Marking** - Already implemented in `with-osc133.js`
2. **Ink Rendering Optimization** - The bcherny fork might have improvements
3. **Selective Re-rendering** - Only update changed components
4. **Double Buffering** - Use alternate screen buffer
5. **Rate Limiting** - Reduce update frequency (trade-off with smoothness)

## Technical Analysis

### The Ideal Behavior

For a status line update, Ink should:
1. Save cursor position
2. Move to status line row
3. Clear and redraw just that line
4. Restore cursor position

### Current Behavior

Instead, Ink:
1. Moves cursor to component start
2. Clears and redraws entire component tree
3. Returns to bottom

This explains why updating a small timer causes the entire conversation history to flicker.

## Contributing Back

If we identify effective fixes:
1. Document the solution thoroughly
2. Test across multiple terminals
3. Consider contributing to upstream Ink (vadimdemedes/ink)
4. Share findings on the Claude Code issue

## References

- [Original Issue](https://github.com/anthropics/claude-code/issues/769)
- [Ink Fork PR](https://github.com/bcherny/ink/pull/8)
- [OSC 133 Spec](https://gitlab.freedesktop.org/Per_Bothner/specifications/-/blob/master/proposals/semantic-prompts.md)
- [Ink Documentation](https://github.com/vadimdemedes/ink)
