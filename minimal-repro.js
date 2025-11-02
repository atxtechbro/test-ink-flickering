#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';

const { createElement: h } = React;

// Generate a LOT of conversation history - more than can fit on screen
const generateLargeConversation = () => {
	const messages = [];

	// Add initial messages
	messages.push({ role: 'user', text: 'Hello, can you help me with this issue?' });
	messages.push({ role: 'assistant', text: 'Of course! I\'d be happy to help. What seems to be the problem?' });
	messages.push({ role: 'user', text: 'I\'m experiencing screen flickering in my terminal application.' });
	messages.push({ role: 'assistant', text: 'That\'s a common issue with terminal rendering. Let me investigate the root cause and provide you with a detailed explanation of what\'s happening.' });

	// Add lots more conversation to force scrolling
	const topics = [
		'terminal rendering and buffer management',
		'ANSI escape sequences and control codes',
		'OSC 133 prompt marking sequences',
		'cursor positioning and screen updates',
		'double buffering techniques',
		'terminal emulator optimization',
		'React component lifecycle in terminals',
		'Ink framework rendering behavior',
		'screen flickering root causes',
		'visual artifacts in terminal UIs',
		'performance optimization strategies',
		'debugging terminal applications',
		'profiling render cycles',
		'identifying bottlenecks',
		'testing across different terminals'
	];

	for (let i = 0; i < 50; i++) {
		const topic = topics[i % topics.length];

		messages.push({
			role: 'user',
			text: `Can you explain more about ${topic}? I want to understand this in detail so I can fix the flickering issue in my application.`
		});

		messages.push({
			role: 'assistant',
			text: `Great question about ${topic}! This is an important aspect of terminal UI development. Let me explain in detail: ${topic} involves understanding how the terminal emulator processes and displays content. When dealing with ${topic}, you need to consider both performance and visual quality. The key is to minimize unnecessary redraws while maintaining smooth updates.`
		});

		if (i % 3 === 0) {
			messages.push({
				role: 'assistant',
				text: `Additionally, regarding ${topic}, it's worth noting that different terminal emulators handle this differently. Some are more optimized than others, which is why you might see varying behavior across terminals.`
			});
		}
	}

	messages.push({ role: 'user', text: 'This is very helpful! Can you summarize the key points?' });
	messages.push({ role: 'assistant', text: 'Absolutely! The main takeaways are: 1) Terminal flickering is caused by full buffer redraws, 2) OSC 133 sequences can help optimize rendering, 3) Testing across different terminals is important, 4) The Ink library has known rendering issues that are being addressed.' });

	return messages;
};

const conversationHistory = generateLargeConversation();

const App = () => {
	const [elapsedTime, setElapsedTime] = useState(0);

	// Update elapsed time every 100ms to simulate frequent updates
	// This should trigger flickering when there's lots of content
	useEffect(() => {
		const interval = setInterval(() => {
			setElapsedTime(t => t + 100);
		}, 100);

		return () => clearInterval(interval);
	}, []);

	const formatTime = (ms) => {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	};

	return h(Box, { flexDirection: 'column', padding: 1 },
		// Conversation History - LOTS of it to force scrolling
		h(Box, { flexDirection: 'column', marginBottom: 1 },
			conversationHistory.map((msg, idx) =>
				h(Box, { key: idx, flexDirection: 'column', marginBottom: 1 },
					h(Text, { bold: true, color: msg.role === 'user' ? 'cyan' : 'green' },
						msg.role === 'user' ? '❯ User' : '◆ Assistant'
					),
					h(Text, null, msg.text)
				)
			)
		),

		// Status Line - Updates frequently like Claude Code's "thinking" indicator
		h(Box, { borderStyle: 'round', borderColor: 'yellow', paddingX: 1 },
			h(Text, { color: 'yellow' },
				h(Spinner, { type: 'dots' }),
				' Processing'
			),
			h(Text, { color: 'gray', dimColor: true }, ` • ${formatTime(elapsedTime)}`)
		),

		// Additional info
		h(Box, { marginTop: 1 },
			h(Text, { dimColor: true },
				'This app mimics Claude Code\'s rendering pattern with frequent status updates.'
			)
		),
		h(Box, null,
			h(Text, { dimColor: true },
				'Watch for flickering when the spinner/timer updates every 100ms.'
			)
		)
	);
};

console.log(chalk.bold.blue('\n🔍 Ink Flickering Reproduction Test\n'));
console.log(chalk.gray('Starting test app with LARGE conversation history...'));
console.log(chalk.yellow(`Generated ${conversationHistory.length} messages - way more than fits on screen!`));
console.log(chalk.gray('The status line updates every 100ms - watch for screen flickering.\n'));
console.log(chalk.red('⚠️  The content is bigger than your terminal - this should trigger flickering!\n'));

render(h(App));
