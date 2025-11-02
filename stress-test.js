#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';

const { createElement: h } = React;

// Generate a lot of conversation history to trigger scrolling
const generateHistory = (count) => {
	const messages = [];
	const topics = [
		'terminal rendering', 'ANSI escape codes', 'OSC sequences',
		'buffer management', 'screen flickering', 'UI optimization',
		'React components', 'Node.js performance', 'TypeScript types'
	];

	for (let i = 0; i < count; i++) {
		const topic = topics[i % topics.length];
		messages.push({
			role: i % 3 === 0 ? 'user' : 'assistant',
			text: `Message ${i + 1}: This is a test message about ${topic}. It helps us understand how the terminal handles large amounts of scrolling content with frequent updates.`
		});
	}
	return messages;
};

const conversationHistory = generateHistory(50);

const App = () => {
	const [elapsedTime, setElapsedTime] = useState(0);
	const [messageCount, setMessageCount] = useState(20);
	const [cpuUsage, setCpuUsage] = useState(0);

	// AGGRESSIVE: Update every 50ms instead of 100ms
	useEffect(() => {
		const interval = setInterval(() => {
			setElapsedTime(t => t + 50);
			// Simulate changing CPU usage to add more visual changes
			setCpuUsage(Math.floor(Math.random() * 100));
		}, 50);

		return () => clearInterval(interval);
	}, []);

	// Add new messages more frequently to trigger scrolling
	useEffect(() => {
		const interval = setInterval(() => {
			if (messageCount < conversationHistory.length) {
				setMessageCount(c => c + 1);
			}
		}, 2000);

		return () => clearInterval(interval);
	}, [messageCount]);

	const formatTime = (ms) => {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	};

	return h(Box, { flexDirection: 'column', padding: 1 },
		// Large conversation history to trigger scrolling
		h(Box, { flexDirection: 'column', marginBottom: 1 },
			conversationHistory.slice(0, messageCount).map((msg, idx) =>
				h(Box, { key: idx, flexDirection: 'column', marginBottom: 1 },
					h(Text, { bold: true, color: msg.role === 'user' ? 'cyan' : 'green' },
						msg.role === 'user' ? '❯ User' : '◆ Assistant'
					),
					h(Text, null, msg.text),
					idx % 5 === 0 ? h(Text, { color: 'magenta', dimColor: true },
						'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
					) : null
				)
			)
		),

		// Status Line - Updates VERY frequently (50ms)
		h(Box, { borderStyle: 'round', borderColor: 'yellow', paddingX: 1 },
			h(Text, { color: 'yellow' },
				h(Spinner, { type: 'dots' }),
				' Processing'
			),
			h(Text, { color: 'gray', dimColor: true }, ` • ${formatTime(elapsedTime)}`),
			h(Text, { color: 'cyan', dimColor: true }, ` • CPU: ${cpuUsage}%`),
			h(Text, { color: 'magenta', dimColor: true }, ` • Msgs: ${messageCount}/${conversationHistory.length}`)
		),

		// Additional info with changing content
		h(Box, { marginTop: 1 },
			h(Text, { dimColor: true },
				'⚡ STRESS TEST MODE: Updates every 50ms with scrolling content'
			)
		),
		h(Box, null,
			h(Text, { dimColor: true },
				'This aggressive rendering should make flickering more obvious if present.'
			)
		),
		h(Box, null,
			h(Text, { color: 'red', dimColor: true },
				'⚠️  May be uncomfortable for users sensitive to flashing lights!'
			)
		)
	);
};

console.log(chalk.bold.red('\n⚡ Ink Flickering STRESS TEST\n'));
console.log(chalk.yellow('WARNING: This test updates aggressively (every 50ms) and may cause discomfort.'));
console.log(chalk.gray('Press Ctrl+C to stop at any time.\n'));
console.log(chalk.gray('Starting stress test with rapid updates and scrolling content...\n'));

render(h(App));
