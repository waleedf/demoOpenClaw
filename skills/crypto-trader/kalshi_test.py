#!/usr/bin/env python3
"""
Kalshi Demo API Test Script
Tests basic connectivity and operations on the demo environment.
"""

import json
import time
import base64
from datetime import datetime
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
import requests

# Demo environment config
BASE_URL = "https://demo-api.kalshi.co/trade-api/v2"
API_KEY_ID = "3ac0693e-1abb-4b70-b9bb-571fd20630ef"
PRIVATE_KEY_PATH = "/data/workspace/.keys/kalshi_demo_key.pem"

def load_private_key():
    """Load RSA private key from file."""
    with open(PRIVATE_KEY_PATH, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)

def sign_request(private_key, timestamp_ms, method, path, body=""):
    """Create RSA-PSS signature for Kalshi API."""
    message = f"{timestamp_ms}{method}{path}{body}".encode()
    signature = private_key.sign(
        message,
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH
        ),
        hashes.SHA256()
    )
    return base64.b64encode(signature).decode()

def make_request(method, endpoint, data=None):
    """Make authenticated request to Kalshi API."""
    private_key = load_private_key()
    timestamp_ms = str(int(time.time() * 1000))
    path = f"/trade-api/v2{endpoint}"
    body = json.dumps(data) if data else ""
    
    signature = sign_request(private_key, timestamp_ms, method, path, body)
    
    headers = {
        "KALSHI-ACCESS-KEY": API_KEY_ID,
        "KALSHI-ACCESS-TIMESTAMP": timestamp_ms,
        "KALSHI-ACCESS-SIGNATURE": signature,
        "Content-Type": "application/json"
    }
    
    url = f"{BASE_URL}{endpoint}"
    
    if method == "GET":
        response = requests.get(url, headers=headers)
    elif method == "POST":
        response = requests.post(url, headers=headers, data=body)
    else:
        raise ValueError(f"Unsupported method: {method}")
    
    return response

def test_connection():
    """Test basic API connectivity."""
    print("=" * 60)
    print("KALSHI DEMO API TEST")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Environment: Demo (demo-api.kalshi.co)")
    print()

def test_balance():
    """Check account balance."""
    print("📊 Checking account balance...")
    response = make_request("GET", "/portfolio/balance")
    
    if response.status_code == 200:
        data = response.json()
        balance_cents = data.get("balance", 0)
        print(f"   ✅ Balance: ${balance_cents / 100:.2f}")
        return balance_cents
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}")
        return None

def test_positions():
    """Check open positions."""
    print("\n📈 Checking open positions...")
    response = make_request("GET", "/portfolio/positions")
    
    if response.status_code == 200:
        data = response.json()
        positions = data.get("market_positions", [])
        if positions:
            print(f"   ✅ Found {len(positions)} position(s):")
            for pos in positions[:5]:  # Show first 5
                ticker = pos.get("ticker", "?")
                quantity = pos.get("position", 0)
                print(f"      - {ticker}: {quantity} contracts")
        else:
            print("   ✅ No open positions")
        return positions
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}")
        return None

def test_markets():
    """Fetch BTC-related markets."""
    print("\n🔍 Searching for BTC markets...")
    # Get markets with BTC in the series
    response = make_request("GET", "/markets?limit=20&status=open")
    
    if response.status_code == 200:
        data = response.json()
        markets = data.get("markets", [])
        btc_markets = [m for m in markets if "BTC" in m.get("ticker", "").upper() or "bitcoin" in m.get("title", "").lower()]
        
        if btc_markets:
            print(f"   ✅ Found {len(btc_markets)} BTC market(s):")
            for m in btc_markets[:5]:
                ticker = m.get("ticker", "?")
                title = m.get("title", "?")[:50]
                yes_bid = m.get("yes_bid", 0)
                yes_ask = m.get("yes_ask", 0)
                volume = m.get("volume", 0)
                print(f"      - {ticker}")
                print(f"        {title}...")
                print(f"        Bid: {yes_bid}¢ | Ask: {yes_ask}¢ | Vol: {volume}")
        else:
            print("   ⚠️  No BTC markets found in first 20 results")
            print("   Showing first 5 available markets:")
            for m in markets[:5]:
                ticker = m.get("ticker", "?")
                title = m.get("title", "?")[:50]
                print(f"      - {ticker}: {title}...")
        return markets
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}")
        return None

def test_specific_market(ticker):
    """Get details for a specific market."""
    print(f"\n📋 Getting details for {ticker}...")
    response = make_request("GET", f"/markets/{ticker}")
    
    if response.status_code == 200:
        data = response.json()
        market = data.get("market", {})
        print(f"   ✅ Market: {market.get('title', '?')}")
        print(f"      Status: {market.get('status', '?')}")
        print(f"      Yes Bid: {market.get('yes_bid', 0)}¢")
        print(f"      Yes Ask: {market.get('yes_ask', 0)}¢")
        print(f"      Volume: {market.get('volume', 0)}")
        print(f"      Close Time: {market.get('close_time', '?')}")
        return market
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}")
        return None

def test_orderbook(ticker):
    """Get orderbook for a market."""
    print(f"\n📚 Getting orderbook for {ticker}...")
    response = make_request("GET", f"/markets/{ticker}/orderbook")
    
    if response.status_code == 200:
        data = response.json()
        orderbook = data.get("orderbook", {})
        yes_bids = orderbook.get("yes", [])[:3]
        no_bids = orderbook.get("no", [])[:3]
        
        print("   ✅ Top 3 YES bids:")
        for bid in yes_bids:
            print(f"      {bid[0]}¢ x {bid[1]}")
        
        print("   Top 3 NO bids (= YES asks):")
        for bid in no_bids:
            ask_price = 100 - bid[0]
            print(f"      {ask_price}¢ x {bid[1]}")
        return orderbook
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}")
        return None

if __name__ == "__main__":
    test_connection()
    
    balance = test_balance()
    positions = test_positions()
    markets = test_markets()
    
    # If we found markets, test details on first one
    if markets:
        first_ticker = markets[0].get("ticker")
        if first_ticker:
            test_specific_market(first_ticker)
            test_orderbook(first_ticker)
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)
