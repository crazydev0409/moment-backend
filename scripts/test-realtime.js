/**
 * Script to test real-time notifications end-to-end
 */
const { spawn } = require('child_process');
const path = require('path');

// Module name for logging
const ModuleName = '[realtime-test]';

// Helper to format messages
const formatLog = (message) => `${ModuleName} ${message}`;

console.log(formatLog('Starting real-time notification test...'));
console.log(formatLog('This will:'));
console.log(formatLog('1. Start a WebSocket client that listens for notifications'));
console.log(formatLog('2. Wait for 3 seconds to ensure connection'));
console.log(formatLog('3. Send a test notification'));
console.log(formatLog('4. Listen for 30 more seconds for the notification to arrive'));

// Start the WebSocket client process
console.log(formatLog('\nStarting WebSocket client...'));
const socketClient = spawn('node', [path.join(__dirname, 'test-socket.js')], {
  stdio: 'inherit'
});

let notificationSent = false;
let shutdownTimeout;

// Set up cleanup function
const cleanup = () => {
  if (socketClient && !socketClient.killed) {
    socketClient.kill();
  }
  if (shutdownTimeout) {
    clearTimeout(shutdownTimeout);
  }
  process.exit(0);
};

// Set timeout to send notification after 3 seconds
setTimeout(() => {
  console.log(formatLog('\nSending test notification...'));
  
  // Call the notification sender script
  const notificationSender = spawn('node', [path.join(__dirname, 'send-test-notification.js')], {
    stdio: 'inherit'
  });
  
  notificationSender.on('close', (code) => {
    console.log(formatLog(`Notification sender exited with code ${code}`));
    notificationSent = true;
  });
}, 3000);

// Handle process exit
process.on('SIGINT', () => {
  console.log(formatLog('\nTest interrupted, cleaning up...'));
  cleanup();
});

// Auto-exit after 30 seconds
shutdownTimeout = setTimeout(() => {
  console.log(formatLog('\nTest completed, shutting down...'));
  cleanup();
}, 30000); 