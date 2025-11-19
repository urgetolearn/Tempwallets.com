'use client';

/**
 * WalletConnect Modal Component
 * 
 * Modal dialog for connecting to Polkadot dapps via WalletConnect/Reown
 * Includes QR scanner for mobile devices
 */

import { useState, useEffect, useRef } from 'react';
import { useSubstrateWalletConnect } from '@/hooks/useSubstrateWalletConnect';
import { useBrowserFingerprint } from '@/hooks/useBrowserFingerprint';
import { Loader2, Link, Copy, X, QrCode, Camera } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@repo/ui/components/ui/dialog';
import { Html5Qrcode } from 'html5-qrcode';

interface WalletConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletConnectModal({ open, onOpenChange }: WalletConnectModalProps) {
  const { fingerprint } = useBrowserFingerprint();
  const { 
    isInitializing, 
    sessions, 
    pair, 
    disconnect,
    initialize
  } = useSubstrateWalletConnect(fingerprint);
  
  const [uriInput, setUriInput] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Initialize WalletConnect when modal opens (lazy initialization)
  useEffect(() => {
    if (open && fingerprint) {
      initialize().catch((err) => {
        console.error('Failed to initialize WalletConnect:', err);
      });
    }
  }, [open, fingerprint, initialize]);

  // Cleanup scanner on unmount or when modal closes
  useEffect(() => {
    if (!open) {
      stopScanner();
      setShowScanner(false);
      setUriInput('');
      setPairError(null);
    }
  }, [open]);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current = null;
          setIsScanning(false);
        })
        .catch((err) => {
          console.error('Failed to stop scanner:', err);
          scannerRef.current = null;
          setIsScanning(false);
        });
    }
  };

  const startScanner = async () => {
    if (!scannerContainerRef.current) return;

    try {
      const html5QrCode = new Html5Qrcode('walletconnect-scanner');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' }, // Use back camera on mobile
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Successfully scanned QR code
          if (decodedText.startsWith('wc:')) {
            setUriInput(decodedText);
            stopScanner();
            setShowScanner(false);
            // Auto-connect after scanning
            handleConnect(decodedText);
          } else {
            setPairError('Invalid WalletConnect URI in QR code');
          }
        },
        () => {
          // Ignore scanning errors (they're frequent during scanning)
        }
      );
      setIsScanning(true);
    } catch (err) {
      console.error('Failed to start scanner:', err);
      setPairError('Failed to start camera. Please check permissions.');
      setIsScanning(false);
    }
  };

  const handleToggleScanner = () => {
    if (showScanner) {
      stopScanner();
      setShowScanner(false);
    } else {
      setShowScanner(true);
      // Start scanner after a brief delay to ensure container is rendered
      setTimeout(() => {
        startScanner();
      }, 100);
    }
  };

  const handleConnect = async (uri?: string) => {
    const uriToUse = uri || uriInput.trim();
    
    if (!uriToUse) {
      setPairError('Please enter a WalletConnect URI');
      return;
    }

    if (!uriToUse.startsWith('wc:')) {
      setPairError('Invalid WalletConnect URI. Must start with "wc:"');
      return;
    }

    setIsPairing(true);
    setPairError(null);

    try {
      await pair(uriToUse);
      setUriInput(''); // Clear input on success
      // Close modal on successful connection
      onOpenChange(false);
    } catch (err) {
      console.error('Pairing failed:', err);
      setPairError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsPairing(false);
    }
  };

  const handleAutoPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.startsWith('wc:')) {
        setUriInput(text);
        setPairError(null);
      } else {
        setPairError('Clipboard does not contain a valid WalletConnect URI');
      }
    } catch {
      setPairError('Failed to read clipboard. Please paste manually.');
    }
  };

  const handleDisconnect = async (topic: string) => {
    try {
      await disconnect(topic);
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl bg-[#1a1a1a] border border-gray-800 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            🔗 Connect to Polkadot DApp
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Connect to Polkadot ecosystem dapps like Hydration, Unique Network, Bifrost, and more.
            Only your Substrate wallets will be used for these connections.
          </DialogDescription>
        </DialogHeader>

        {isInitializing ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-400">Initializing WalletConnect...</span>
          </div>
        ) : (
          <div className="space-y-4">

            {sessions.length === 0 ? (
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-sm text-blue-300 font-medium mb-2">
                    How to Connect:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300">
                    <li>Visit a Polkadot dapp (e.g., <a href="https://app.hydration.net" target="_blank" rel="noopener noreferrer" className="underline text-blue-400">Hydration</a>)</li>
                    <li>Click &quot;Connect Wallet&quot; → &quot;WalletConnect&quot;</li>
                    <li>Click &quot;Copy Link&quot; or &quot;Copy to Clipboard&quot;</li>
                    <li>Return here and paste the URI below or scan the QR code</li>
                    <li>Click &quot;Connect&quot; and approve the connection</li>
                  </ol>
                </div>

                {/* QR Scanner Section */}
                {showScanner && (
                  <div className="space-y-2">
                    <div className="relative">
                      <div
                        id="walletconnect-scanner"
                        ref={scannerContainerRef}
                        className="w-full rounded-xl overflow-hidden bg-black"
                        style={{ minHeight: '250px' }}
                      />
                      {!isScanning && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <div className="text-center">
                            <Camera className="h-8 w-8 text-white mx-auto mb-2" />
                            <p className="text-white text-sm">Position QR code in frame</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleToggleScanner}
                      className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-white text-sm transition-colors"
                    >
                      Close Scanner
                    </button>
                  </div>
                )}

                {/* URI Input Section */}
                {!showScanner && (
                  <div className="space-y-2">
                    <label htmlFor="wc-uri" className="block text-sm font-medium text-gray-300">
                      WalletConnect URI
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="wc-uri"
                        type="text"
                        placeholder="wc:abc123...@2?relay-protocol=irn&symKey=..."
                        value={uriInput}
                        onChange={(e) => {
                          setUriInput(e.target.value);
                          setPairError(null);
                        }}
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleAutoPaste}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors"
                        title="Paste from clipboard"
                      >
                        <Copy className="h-5 w-5 text-white" />
                      </button>
                    </div>
                    {pairError && (
                      <p className="text-sm text-red-400">{pairError}</p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {!showScanner && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleToggleScanner}
                      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <QrCode className="h-5 w-5" />
                      <span>Scan QR Code</span>
                    </button>
                    <button
                      onClick={() => handleConnect()}
                      disabled={isPairing || !uriInput || !fingerprint}
                      className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-white transition-colors flex items-center justify-center gap-2"
                    >
                      {isPairing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <Link className="h-5 w-5" />
                          <span>Connect</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                  <p className="text-green-400 font-medium text-sm">
                    ✅ Connected to {sessions.length} dapp{sessions.length > 1 ? 's' : ''}
                  </p>
                </div>

                {sessions
                  .filter((session) => session && session.topic)
                  .map((session) => (
                    <div key={session.topic} className="border border-gray-700 rounded-xl p-4 bg-gray-800/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">
                            {session.peer?.metadata?.name || 'Unknown DApp'}
                          </h3>
                          {session.peer?.metadata?.url && (
                            <p className="text-sm text-gray-400 mt-1">
                              <a 
                                href={session.peer.metadata.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:underline text-blue-400"
                              >
                                {session.peer.metadata.url}
                              </a>
                            </p>
                          )}
                          {session.namespaces?.polkadot && (
                            <div className="mt-2 text-xs text-gray-500">
                              <p>Accounts: {session.namespaces.polkadot.accounts?.length || 0}</p>
                              <p>Chains: {session.namespaces.polkadot.chains?.length || 0}</p>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDisconnect(session.topic)}
                          className="ml-4 p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                          title="Disconnect"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

