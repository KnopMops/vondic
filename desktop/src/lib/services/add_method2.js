const fs = require('fs');
const filePath = 'WebRTCService.ts';

let content = fs.readFileSync(filePath, 'utf8');

// The new method to add
const newMethod = `
	private async checkAndNotifyTurnConnection(targetSocketId: string, pc: RTCPeerConnection): Promise<void> {
		try {
			const stats = await pc.getStats();
			let selectedPair: any = null;
			let localCandidate: any = null;

			// Find the selected candidate pair
			stats.forEach((report: any) => {
				if (report.type === 'transport') {
					if (report.selectedCandidatePairId) {
						selectedPair = stats.get(report.selectedCandidatePairId);
					}
				}
			});

			// If not found via transport, look for selected candidate-pair directly
			if (!selectedPair) {
				stats.forEach((report: any) => {
					if (report.type === 'candidate-pair' && report.selected) {
						selectedPair = report;
					}
				});
			}

			if (selectedPair) {
				const localCandidateId = selectedPair.localCandidateId;
				if (localCandidateId) {
					localCandidate = stats.get(localCandidateId);
				}
			}

			// Check if TURN (relay) is being used
			if (localCandidate && localCandidate.candidateType === 'relay') {
				const turnServer = localCandidate.address || 'TURN server';
				const turnUrl = localCandidate.url || turnServer;
				console.log(\`[WebRTC] ✅ Connected via TURN server: \${turnUrl}\`);
				if (this.onTurnConnected) {
					this.onTurnConnected(targetSocketId, turnUrl);
				}
			} else if (localCandidate) {
				console.log(\`[WebRTC] Connected via \${localCandidate.candidateType || 'unknown'} candidate type\`);
			}
		} catch (e) {
			console.error('[WebRTC] Error checking TURN connection:', e);
		}
	}
`;

// Find the location after syncRemoteStreamTracks method ends
// Pattern: closing brace of the method, then blank line(s), then next method
const pattern = /(\t\}\n\s*\n\s*private async processBufferedCandidates)/;
const replacement = '\t}\n' + newMethod + '\n\tprivate async processBufferedCandidates';

if (pattern.test(content)) {
	content = content.replace(pattern, replacement);
	fs.writeFileSync(filePath, content, 'utf8');
	console.log('Method added successfully');
} else {
	console.log('Pattern not found, trying alternative...');
	// Try alternative pattern
	const pattern2 = /(private async processBufferedCandidates)/;
	const replacement2 = newMethod + '\n\n\tprivate async processBufferedCandidates';
	if (pattern2.test(content)) {
		content = content.replace(pattern2, replacement2);
		fs.writeFileSync(filePath, content, 'utf8');
		console.log('Method added successfully (alternative)');
	} else {
		console.log('Could not find insertion point');
	}
}
