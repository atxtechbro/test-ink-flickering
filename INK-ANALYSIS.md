# Ink Rendering Architecture Analysis

**Date**: November 3, 2025
**Ink Version**: v4.4.1
**Objective**: Understand why Ink performs full component redraws on every state change

---

## Executive Summary

We have identified the **root cause** of the terminal flickering issue:

**Ink's architecture performs full-tree traversal and complete screen redraws on every React state change, regardless of which component actually updated.**

Even when only a single status line changes (like a timer updating from "0.1s" to "0.2s"), Ink:
1. Traverses the entire component tree
2. Generates a complete 2D character buffer for all content
3. Erases all previous terminal lines
4. Redraws everything from scratch

This is a fundamental architectural limitation, not a bug.

---

## Architecture Overview

### Rendering Flow

```
React State Change
    ↓
React Reconciler (reconciler.ts:117-136)
    ↓ [calls after EVERY commit]
rootNode.onRender() (ink.tsx:134)
    ↓
render(this.rootNode) (ink.tsx:149)
    ↓
renderNodeToOutput() (renderer.ts:18)
    ↓ [recursive tree traversal]
Traverse ALL nodes (render-node-to-output.ts:33-146)
    ↓
Build complete 2D buffer (output.ts:99-243)
    ↓
Generate output string
    ↓
throttledLog(output) (ink.tsx:192)
    ↓
ansiEscapes.eraseLines(previousLineCount) (log-update.ts:28)
    ↓
Write complete new output
    ↓
Terminal displays full redraw
```

---

## Key Source Files

### 1. reconciler.ts (300 lines)

**Purpose**: React reconciler configuration - bridges React's virtual DOM to Ink's DOM

**Critical Code - Line 117-136**:
```typescript
resetAfterCommit(rootNode) {
    if (typeof rootNode.onComputeLayout === 'function') {
        rootNode.onComputeLayout();
    }

    // Since renders are throttled at the instance level and <Static> component children
    // are rendered only once and then get deleted, we need an escape hatch to
    // trigger an immediate render to ensure <Static> children are written to output before they get erased
    if (rootNode.isStaticDirty) {
        rootNode.isStaticDirty = false;
        if (typeof rootNode.onImmediateRender === 'function') {
            rootNode.onImmediateRender();
        }

        return;
    }

    if (typeof rootNode.onRender === 'function') {
        rootNode.onRender();
    }
}
```

**Finding**: After EVERY React commit (prop change, state change, etc.), `resetAfterCommit` calls `rootNode.onRender()`. This triggers a complete render regardless of what changed.

**Note**: There's a diff function (lines 47-78) that compares old and new props, but this is only used to determine if a single node should update. The reconciler still triggers a full render at the root level.

---

### 2. ink.tsx (332 lines)

**Purpose**: Main Ink class managing rendering lifecycle

**Critical Code - Line 56-61 (Throttling)**:
```typescript
this.rootNode.onRender = options.debug
    ? this.onRender
    : throttle(this.onRender, 32, {
            leading: true,
            trailing: true
      });
```

**Finding**: Renders are throttled to 32ms minimum. This prevents *some* flickering but doesn't address the root cause.

**Critical Code - Line 144-196 (onRender method)**:
```typescript
onRender: () => void = () => {
    if (this.isUnmounted) {
        return;
    }

    const {output, outputHeight, staticOutput} = render(this.rootNode);

    // ... static output handling ...

    if (outputHeight >= this.options.stdout.rows) {
        this.options.stdout.write(
            ansiEscapes.clearTerminal + this.fullStaticOutput + output
        );
        this.lastOutput = output;
        return;
    }

    // ... more rendering logic ...

    if (!hasStaticOutput && output !== this.lastOutput) {
        this.throttledLog(output);
    }

    this.lastOutput = output;
};
```

**Finding**: Line 149 calls `render(this.rootNode)` which generates the complete output. Line 191 checks if output changed, but by this point the entire tree has already been traversed.

---

### 3. renderer.ts (52 lines)

**Purpose**: Entry point for converting DOM tree to terminal output string

**Complete Implementation - Lines 11-51**:
```typescript
const renderer = (node: DOMElement): Result => {
    if (node.yogaNode) {
        const output = new Output({
            width: node.yogaNode.getComputedWidth(),
            height: node.yogaNode.getComputedHeight()
        });

        renderNodeToOutput(node, output, {skipStaticElements: true});

        let staticOutput;

        if (node.staticNode?.yogaNode) {
            staticOutput = new Output({
                width: node.staticNode.yogaNode.getComputedWidth(),
                height: node.staticNode.yogaNode.getComputedHeight()
            });

            renderNodeToOutput(node.staticNode, staticOutput, {
                skipStaticElements: false
            });
        }

        const {output: generatedOutput, height: outputHeight} = output.get();

        return {
            output: generatedOutput,
            outputHeight,
            // Newline at the end is needed, because static output doesn't have one, so
            // interactive output will override last line of static output
            staticOutput: staticOutput ? `${staticOutput.get().output}\n` : ''
        };
    }

    return {
        output: '',
        outputHeight: 0,
        staticOutput: ''
    };
};
```

**Finding**: Line 18 calls `renderNodeToOutput(node, output, ...)` starting from the root node. This initiates a full tree traversal every time.

---

### 4. render-node-to-output.ts (147 lines)

**Purpose**: Recursively traverse DOM tree and write each node to output buffer

**Critical Code - Lines 129-137 (Recursive traversal)**:
```typescript
if (node.nodeName === 'ink-root' || node.nodeName === 'ink-box') {
    for (const childNode of node.childNodes) {
        renderNodeToOutput(childNode as DOMElement, output, {
            offsetX: x,
            offsetY: y,
            transformers: newTransformers,
            skipStaticElements
        });
    }

    if (clipped) {
        output.unclip();
    }
}
```

**Finding**: Every render walks through ALL child nodes recursively. There's no mechanism to skip unchanged subtrees.

---

### 5. output.ts (245 lines)

**Purpose**: Virtual output buffer - builds a 2D character array for the entire UI

**Critical Code - Lines 99-116 (Initialize buffer)**:
```typescript
get(): {output: string; height: number} {
    // Initialize output array with a specific set of rows, so that margin/padding at the bottom is preserved
    const output: StyledChar[][] = [];

    for (let y = 0; y < this.height; y++) {
        const row: StyledChar[] = [];

        for (let x = 0; x < this.width; x++) {
            row.push({
                type: 'char',
                value: ' ',
                fullWidth: false,
                styles: []
            });
        }

        output.push(row);
    }
    // ... then fills buffer from operations ...
}
```

**Finding**: Every render creates a complete 2D character buffer (width × height). For a 80×60 terminal, that's 4,800 characters initialized.

**Critical Code - Lines 230-242 (Generate string)**:
```typescript
const generatedOutput = output
    .map(line => {
        // See https://github.com/vadimdemedes/ink/pull/564#issuecomment-1637022742
        const lineWithoutEmptyItems = line.filter(item => item !== undefined);

        return styledCharsToString(lineWithoutEmptyItems).trimEnd();
    })
    .join('\n');

return {
    output: generatedOutput,
    height: output.length
};
```

**Finding**: The entire 2D buffer is converted to a string. This string represents the COMPLETE UI output.

---

### 6. log-update.ts (53 lines) - **THE SMOKING GUN**

**Purpose**: Handles terminal output updates by erasing and rewriting

**Critical Code - Lines 16-30**:
```typescript
const render = (str: string) => {
    if (!showCursor && !hasHiddenCursor) {
        cliCursor.hide();
        hasHiddenCursor = true;
    }

    const output = str + '\n';
    if (output === previousOutput) {
        return;
    }

    previousOutput = output;
    stream.write(ansiEscapes.eraseLines(previousLineCount) + output);
    previousLineCount = output.split('\n').length;
};
```

**Finding**: **Line 28 is the direct cause of flickering**:
```typescript
stream.write(ansiEscapes.eraseLines(previousLineCount) + output);
```

This erases ALL previous lines (moving cursor up and clearing each line), then writes the complete new output.

For a 60-line UI, this generates:
```
[2K[1A[2K[1A[2K[1A... (repeated 60 times)
```

Then writes 60 lines of new content.

**Why it flickers**: The erase-and-redraw cycle is visible to the user, especially in terminals like tmux that don't have sophisticated double-buffering.

---

## Why This Architecture Exists

### Design Philosophy

Ink's architecture is modeled after React's reconciliation pattern:

1. **Simplicity**: Always render the complete tree - easy to reason about
2. **Correctness**: No risk of stale content or partial updates
3. **React Compatibility**: Matches React's re-render model
4. **Stateless**: Each render is independent, no complex state tracking

### Trade-offs

**Benefits**:
- Simpler codebase
- Easier to maintain
- Fewer edge cases
- Perfect consistency

**Costs**:
- Performance overhead from full tree traversal
- Visual flickering from complete redraws
- Wasted CPU cycles rendering unchanged content
- Poor UX in terminals without double-buffering

---

## Why Selective Updates Are Hard

Implementing selective/partial updates would require:

### 1. Terminal Cursor Management
- Track current cursor position precisely
- Move cursor to specific line that changed
- Update only that line
- Restore cursor to correct position

**Problem**: ANSI cursor positioning is complex and error-prone across different terminals.

### 2. Differential Rendering
- Compare old vs new virtual DOM trees
- Identify which lines changed
- Generate minimal set of escape sequences
- Handle edge cases (content shifting, line wrapping)

**Problem**: Requires sophisticated diffing algorithm and terminal state tracking.

### 3. Layout Recalculation
- Yoga layout engine calculates positions for ALL nodes
- Changing one component might affect others (flexbox, wrapping)
- Hard to know which lines are affected without full layout pass

**Problem**: Layout dependencies make it difficult to isolate changes.

### 4. Terminal State Synchronization
- Track what's currently displayed
- Handle terminal resizes
- Deal with external writes (console.log, stderr)
- Handle scrolling and viewport changes

**Problem**: Maintaining perfect sync between internal state and actual terminal is complex.

---

## Observed Escape Sequence Pattern

From our testing, a typical status line update generates:

```
[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A
[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A
[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A
[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A
[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A
[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A[2K[1A
... (60+ times for 60-line UI)
```

Breaking down the escape sequences:
- `[2K` = ESC[2K = Clear entire line
- `[1A` = ESC[1A = Move cursor up one line

**Process**:
1. Cursor starts at bottom of UI
2. Move up one line, clear it
3. Repeat for every line
4. Rewrite all 60 lines of content
5. Cursor ends at bottom

**Timing**: This happens every 100ms (our test) or 32ms minimum (Ink's throttle)

---

## Comparison with Other TUI Libraries

### Blessed
- Uses screen diffing (compares old vs new screen state)
- Only updates changed regions
- More complex implementation, fewer flickers

### Textual (Python)
- Full rendering pipeline with compositor
- Double-buffering and dirty region tracking
- Much more complex but smoother

### Ink's Approach
- Simplest: always redraw everything
- Trade-off: simplicity vs performance
- Works well for infrequent updates
- Problematic for frequent updates (like animated status lines)

---

## Feasibility Assessment for Fixes

### Option 1: Modify log-update.ts Only ❌

**Idea**: Keep Ink's architecture but change how log-update writes to terminal

**Problems**:
- log-update receives complete output string
- No information about what changed
- Can't selectively update without diffing entire string
- String diffing is insufficient (doesn't know line positions)

**Verdict**: Not feasible without upstream changes

---

### Option 2: Add Differential Rendering to renderer.ts ⚠️

**Idea**: Compare old and new output buffers, generate minimal updates

**Requirements**:
- Cache previous Output buffer
- Diff old vs new character arrays
- Generate cursor movement + partial updates
- Handle edge cases (resizing, scrolling)

**Challenges**:
- ~500-1000 lines of new code
- Complex edge cases
- Need to handle all terminal types
- May break existing behavior

**Verdict**: Technically possible but HIGH effort

---

### Option 3: React-Level Optimization 🤔

**Idea**: Prevent reconciler from triggering full renders

**Requirements**:
- Modify reconciler.ts to track dirty nodes
- Only render dirty subtrees
- Still need to handle layout dependencies

**Challenges**:
- React reconciler already commits whole trees
- Would need React-level changes
- Layout recalculation still requires full tree

**Verdict**: Architecturally difficult, may not be worth it

---

### Option 4: Alternate Rendering Mode for Status Lines ✅

**Idea**: Special-case frequently updating components

**Approach**:
- Introduce `<StatusLine>` component with separate rendering path
- Render status line to a separate terminal region (last line)
- Use absolute cursor positioning (ESC[{row};{col}H)
- Don't erase, just overwrite that line

**Requirements**:
- New component type in Ink
- Bypass normal rendering for status components
- Careful cursor management

**Challenges**:
- ~200-300 lines of code
- Need to reserve terminal space
- Interaction with scrolling
- May not work in all terminals

**Verdict**: Most practical approach, moderate effort

---

## Next Steps

### Phase 2: Experimentation

Based on this analysis, we should pursue **Option 4: Alternate Rendering Mode**.

**Plan**:

1. **Prototype StatusLine component** (2-3 hours)
   - Create new component type: `<StatusLine>`
   - Bypass renderer.ts for these components
   - Use absolute cursor positioning
   - Test in minimal-repro.js

2. **Handle edge cases** (2-3 hours)
   - Terminal resizing
   - Scrolling behavior
   - Multiple status lines
   - Interaction with <Static>

3. **Test across terminals** (1-2 hours)
   - GNOME Terminal
   - tmux
   - VS Code terminal
   - Kitty

4. **Evaluate results** (1 hour)
   - Does flickering stop?
   - Any new issues?
   - Is it worth upstreaming?

---

## Alternative: Document Workarounds

If implementing a fix proves too complex, we should document workarounds:

### For Users
1. Use terminals with better buffering (Kitty, Windows Terminal)
2. Reduce update frequency (200ms instead of 100ms)
3. Minimize scrollback (keep UI small)
4. Use tmux with `set -g terminal-overrides 'xterm*:smcup@:rmcup@'`

### For Claude Code
1. Make status updates less frequent (200ms+ throttle)
2. Move status line to a separate process/UI
3. Use a different TUI library for status indication
4. Implement custom rendering for status components

---

## Conclusion

**Root Cause Confirmed**: Ink performs complete tree traversals and full redraws on every state change due to its architecture prioritizing simplicity over performance.

**Flickering Mechanism**: log-update.ts:28 erases all lines and rewrites everything, causing visible flicker in terminals without double-buffering.

**Fix Complexity**: Ranges from moderate (Option 4: StatusLine component) to high (Option 2: Differential rendering).

**Recommended Path**: Prototype Option 4 (special rendering mode for status lines) as it's the most practical fix with reasonable effort.

---

**Analysis Complete**: 2025-11-03
**Files Read**: 6 core Ink source files (~1,200 lines)
**Time Investment**: ~2 hours
**Confidence Level**: High - root cause definitively identified
