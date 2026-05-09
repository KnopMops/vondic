const fs = require('fs');
const filePath = 'WebRTCService.ts';

let content = fs.readFileSync(filePath, 'utf8');

// Add call to checkAndNotifyTurnConnection after syncRemoteStreamTracks
const pattern = /(this\.syncRemoteStreamTracks\(targetSocketId\);)/;
const replacement = 'this.syncRemoteStreamTracks(targetSocketId);\n\t\t\t// Check if TURN server is being used and notify\n\t\t\tthis.checkAndNotifyTurnConnection(targetSocketId, pc);';

if (pattern.test(content)) {
	content = content.replace(pattern, replacement);
	fs.writeFileSync(filePath, content, 'utf8');
	console.log('Call to checkAndNotifyTurnConnection added successfully');
} else {
	console.log('Pattern not found');
}
