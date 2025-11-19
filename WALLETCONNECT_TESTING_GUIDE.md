# Substrate WalletConnect Testing Guide

This guide will help you test the Substrate WalletConnect integration from the UI.

## 📋 Prerequisites

1. **Backend running**: Make sure your backend server is running on `http://localhost:5005`
2. **Frontend running**: Make sure your frontend is running on `http://localhost:3000`
3. **Wallet initialized**: You should have at least one Substrate wallet address created
4. **WalletConnect Project ID**: Ensure `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set in your `.env.local` file

## 🚀 Quick Start

### Step 1: Access the WalletConnect Page

1. Navigate to: `http://localhost:3000/dashboard/walletconnect`
2. You should see the Substrate WalletConnect component

### Step 2: Verify Your Setup

Before testing, verify that:
- ✅ The component shows "Initializing WalletConnect..." then loads successfully
- ✅ No error messages are displayed
- ✅ You see the connection instructions

## 🧪 Testing with Real DApps

### Option 1: Test with Hydration (Recommended)

**Hydration** is a popular Polkadot DEX that supports WalletConnect.

#### Steps:

1. **Open Hydration DApp**:
   - Visit: https://app.hydration.net
   - Or testnet: https://testnet.hydration.net (if available)

2. **Initiate Connection**:
   - Click "Connect Wallet" button
   - Select "WalletConnect" option
   - You'll see a QR code and a "Copy Link" button

3. **Copy the WalletConnect URI**:
   - Click "Copy Link" or "Copy to Clipboard"
   - The URI will look like: `wc:abc123...@2?relay-protocol=irn&symKey=...`

4. **Paste in TempWallets**:
   - Go back to `http://localhost:3000/dashboard/walletconnect`
   - Paste the URI in the input field (or click the 📋 button to auto-paste)
   - Click "Connect"

5. **Approve the Connection**:
   - A confirmation dialog will appear
   - Review the dapp details (name, URL, chains, methods)
   - Click "OK" to approve or "Cancel" to reject

6. **Verify Connection**:
   - You should see a green success message: "✅ Connected to 1 dapp"
   - The session card shows the dapp name, URL, and account details

### Option 2: Test with Unique Network

**Unique Network** is another Polkadot ecosystem dapp.

1. Visit: https://unique.network
2. Follow the same steps as above (Connect → WalletConnect → Copy URI → Paste in TempWallets)

### Option 3: Test with Bifrost

**Bifrost** is a DeFi protocol on Polkadot.

1. Visit: https://bifrost.finance
2. Follow the same connection flow

## 🔍 What to Check During Testing

### Connection Flow

1. **Initialization**:
   - ✅ Component loads without errors
   - ✅ Shows "Initializing WalletConnect..." briefly
   - ✅ Displays connection instructions

2. **URI Input**:
   - ✅ Can paste WalletConnect URI
   - ✅ Auto-paste button works (📋)
   - ✅ Validates URI format (must start with `wc:`)
   - ✅ Shows error for invalid URIs

3. **Pairing**:
   - ✅ Shows "Connecting..." state
   - ✅ Successfully pairs with dapp
   - ✅ Clears input after successful connection

4. **Session Approval**:
   - ✅ Shows confirmation dialog with dapp details
   - ✅ Can approve or reject
   - ✅ Only shows Polkadot namespace (not EVM)

5. **Connected State**:
   - ✅ Shows success message
   - ✅ Displays session card with dapp info
   - ✅ Shows number of accounts and chains
   - ✅ Can disconnect from session

### Transaction Signing

Once connected, test transaction signing:

1. **In the DApp**:
   - Try to perform an action that requires signing (e.g., swap, transfer)
   - The dapp will send a transaction request

2. **In TempWallets**:
   - A confirmation dialog should appear
   - Shows transaction details (account, chain)
   - Can approve or reject

3. **After Approval**:
   - Transaction is signed and sent
   - DApp receives the signature
   - Transaction appears in dapp's transaction history

### Message Signing

Test message signing:

1. **In the DApp**:
   - Request to sign a message
   - DApp sends `polkadot_signMessage` request

2. **In TempWallets**:
   - Confirmation dialog shows message content
   - Can approve or reject

3. **After Approval**:
   - Message is signed
   - Signature is returned to dapp

## 🐛 Troubleshooting

### Issue: "WalletConnect client not initialized"

**Solution**:
- Check that `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set in `.env.local`
- Restart the frontend server
- Check browser console for errors

### Issue: "Failed to get Substrate WalletConnect accounts"

**Solution**:
- Ensure backend is running
- Verify you have Substrate addresses created
- Check backend logs for errors
- Test the endpoint directly: `GET /wallet/substrate/walletconnect/accounts?userId=YOUR_USER_ID`

### Issue: "Invalid WalletConnect URI"

**Solution**:
- Ensure URI starts with `wc:`
- Check that URI is complete (not truncated)
- Try copying the URI again from the dapp

### Issue: "User rejected the connection"

**Solution**:
- This is expected if you click "Cancel" in the confirmation dialog
- Click "OK" to approve the connection

### Issue: Connection times out

**Solution**:
- Check your internet connection
- Verify WalletConnect relay servers are accessible
- Try again with a fresh URI from the dapp

## 📊 Testing Checklist

Use this checklist to verify all functionality:

- [ ] Component loads without errors
- [ ] Can paste WalletConnect URI
- [ ] Auto-paste button works
- [ ] URI validation works (rejects invalid URIs)
- [ ] Successfully pairs with dapp
- [ ] Confirmation dialog appears
- [ ] Can approve connection
- [ ] Can reject connection
- [ ] Connected state displays correctly
- [ ] Session card shows dapp details
- [ ] Can disconnect from session
- [ ] Transaction signing works
- [ ] Message signing works
- [ ] Only Substrate accounts are shown (not EVM)
- [ ] Error handling works (shows clear error messages)

## 🔗 Test DApps

Here are some Polkadot dapps you can test with:

1. **Hydration**: https://app.hydration.net
2. **Unique Network**: https://unique.network
3. **Bifrost**: https://bifrost.finance
4. **Polkadot.js Apps**: https://polkadot.js.org/apps (supports WalletConnect)

## 📝 Expected Behavior

### Successful Connection Flow

1. User pastes URI → Click "Connect"
2. Component shows "Connecting..." state
3. WalletConnect client pairs with dapp
4. Confirmation dialog appears
5. User approves → Session is created
6. Component shows "✅ Connected to 1 dapp"
7. Session card displays dapp information

### Transaction Signing Flow

1. DApp sends transaction request
2. Confirmation dialog appears in browser
3. User reviews transaction details
4. User approves → Transaction is signed
5. Signature is returned to dapp
6. Transaction is broadcast to network

### Message Signing Flow

1. DApp sends message signing request
2. Confirmation dialog shows message content
3. User approves → Message is signed
4. Signature is returned to dapp

## 🎯 Key Features to Verify

1. **Substrate-Only**: Only Polkadot namespace is handled, EVM chains are excluded
2. **CAIP-10 Format**: Accounts are formatted as `polkadot:<genesis_hash>:<address>`
3. **Security**: Account ownership is validated before signing
4. **User Confirmation**: All signing operations require user approval
5. **Error Handling**: Clear error messages for failures

## 📞 Support

If you encounter issues:

1. Check browser console for errors
2. Check backend logs for errors
3. Verify all environment variables are set
4. Ensure backend and frontend are running
5. Test with a different dapp to isolate issues

## 🎉 Success Criteria

You've successfully tested the integration when:

- ✅ Can connect to at least one Polkadot dapp
- ✅ Can sign transactions from the dapp
- ✅ Can sign messages from the dapp
- ✅ Can disconnect from sessions
- ✅ Only Substrate wallets are used (EVM wallets are not exposed)

Happy testing! 🚀

