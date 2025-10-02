const WebSocket = require('ws');

const WS_ENDPOINT = 'wss://pumpportal.fun/api/data';

const subscriptions = [
  { method: 'subscribeNewToken' },
  { method: 'subscribeMigration' },
  {
    method: 'subscribeAccountTrade',
    keys: ['AArPXm8JatJiuyEffuC1un2Sc835SULa4uQqDcaGpAjV'],
  },
  {
    method: 'subscribeTokenTrade',
    keys: ['91WNez8D22NwBssQbkzjy4s2ipFrzpmn5hfvWVe2aY5p'],
  },
];

console.log(`Connecting to PumpPortal at ${WS_ENDPOINT}...`);

const ws = new WebSocket(WS_ENDPOINT);

ws.on('open', () => {
  console.log('WebSocket connection opened. Registering subscriptions...');
  subscriptions.forEach((payload) => {
    ws.send(JSON.stringify(payload));
    console.log('→ Sent', payload);
  });
});

ws.on('message', (data) => {
  try {
    const parsed = JSON.parse(data);
    console.log('← Event', parsed);
  } catch (error) {
    console.error('Failed to parse message', error);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error', error);
});

ws.on('close', (code, reason) => {
  console.log('WebSocket closed', { code, reason: reason.toString() });
});

process.on('SIGINT', () => {
  console.log('\nClosing connection...');
  ws.close();
  process.exit(0);
});
