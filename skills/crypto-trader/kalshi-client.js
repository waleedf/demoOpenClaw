/**
 * Kalshi API Client
 * Reusable functions for interacting with Kalshi
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

const ENVIRONMENTS = {
  production: {
    host: 'api.elections.kalshi.com',
    keyPath: '/data/workspace/.keys/kalshi_private_key.pem',
    apiKey: 'fedaa700-afc2-4646-93d5-b2b491735d6e'
  },
  demo: {
    host: 'demo-api.kalshi.co',
    keyPath: '/data/workspace/.keys/kalshi_demo_key.pem',
    apiKey: '3ac0693e-1abb-4b70-b9bb-571fd20630ef'
  }
};

// Set environment: 'production' or 'demo'
const ENV = process.env.KALSHI_ENV || 'production';
const CONFIG = {
  privateKeyPath: ENVIRONMENTS[ENV].keyPath,
  apiKey: ENVIRONMENTS[ENV].apiKey,
  baseHost: ENVIRONMENTS[ENV].host,
  basePath: '/trade-api/v2'
};

let _privateKey = null;

function getPrivateKey() {
  if (!_privateKey) {
    _privateKey = fs.readFileSync(CONFIG.privateKeyPath, 'utf8');
  }
  return _privateKey;
}

function sign(method, path) {
  const timestamp = Date.now().toString();
  const msg = timestamp + method + path;
  const signature = crypto.sign('sha256', Buffer.from(msg), {
    key: getPrivateKey(),
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
  }).toString('base64');
  return { timestamp, signature };
}

function request(method, path, body = null, auth = false) {
  return new Promise((resolve, reject) => {
    const fullPath = CONFIG.basePath + path;
    const headers = { 'Content-Type': 'application/json' };

    if (auth) {
      const { timestamp, signature } = sign(method, fullPath);
      headers['KALSHI-ACCESS-KEY'] = CONFIG.apiKey;
      headers['KALSHI-ACCESS-SIGNATURE'] = signature;
      headers['KALSHI-ACCESS-TIMESTAMP'] = timestamp;
    }

    const req = https.request({
      hostname: CONFIG.baseHost,
      path: fullPath,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data, error: e.message });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Public endpoints
const getMarkets = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request('GET', '/markets' + (qs ? '?' + qs : ''));
};

const getMarket = (ticker) => request('GET', `/markets/${ticker}`);
const getOrderbook = (ticker) => request('GET', `/markets/${ticker}/orderbook`, null, true);
const getTrades = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request('GET', '/markets/trades' + (qs ? '?' + qs : ''));
};
const getSeries = (ticker) => request('GET', `/series/${ticker}`);
const getEvents = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request('GET', '/events' + (qs ? '?' + qs : ''));
};

// Authenticated endpoints
const getBalance = () => request('GET', '/portfolio/balance', null, true);
const getPositions = () => request('GET', '/portfolio/positions', null, true);
const getOrders = () => request('GET', '/portfolio/orders', null, true);
const getFills = () => request('GET', '/portfolio/fills', null, true);

const placeOrder = (order) => request('POST', '/portfolio/orders', order, true);
const cancelOrder = (orderId) => request('DELETE', `/portfolio/orders/${orderId}`, null, true);

// Utility: Find active markets by recent trade volume
async function findActiveSeries(limit = 100) {
  const { data } = await getTrades({ limit });
  if (!data.trades) return [];

  const byPrefix = {};
  data.trades.forEach(t => {
    const prefix = t.ticker.split('-')[0];
    if (!byPrefix[prefix]) byPrefix[prefix] = { trades: 0, contracts: 0, tickers: new Set() };
    byPrefix[prefix].trades++;
    byPrefix[prefix].contracts += t.count;
    byPrefix[prefix].tickers.add(t.ticker);
  });

  return Object.entries(byPrefix)
    .map(([series, info]) => ({ series, ...info, markets: info.tickers.size }))
    .sort((a, b) => b.trades - a.trades);
}

module.exports = {
  getMarkets, getMarket, getOrderbook, getTrades, getSeries, getEvents,
  getBalance, getPositions, getOrders, getFills,
  placeOrder, cancelOrder,
  findActiveSeries
};

// CLI test
if (require.main === module) {
  (async () => {
    console.log('Testing Kalshi client...\n');

    const balance = await getBalance();
    console.log('Balance:', balance.data);

    console.log('\nFinding active series...');
    const active = await findActiveSeries(50);
    active.slice(0, 5).forEach(s => {
      console.log(`${s.series}: ${s.trades} trades, ${s.contracts} contracts`);
    });
  })();
}
