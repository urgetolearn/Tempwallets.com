'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@repo/ui/components/ui/dialog';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Label } from '@repo/ui/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Loader2, CheckCircle2, Zap, Copy, QrCode, ScanLine } from 'lucide-react';
import { useLightningNodes } from '@/hooks/useLightningNodes';
import { LightningNode } from '@/lib/api';
import { QRCodeCanvas } from 'qrcode.react';

interface CreateLightningNodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUPPORTED_CHAINS = [
  { id: 'ethereumErc4337', name: 'Ethereum Gasless' },
  { id: 'baseErc4337', name: 'Base Gasless' },
  { id: 'arbitrumErc4337', name: 'Arbitrum' },
  { id: 'polygonErc4337', name: 'Polygon' },
];

const SUPPORTED_TOKENS = ['USDC', 'USDT'];

// Address validation for EVM addresses
const validateEvmAddress = (address: string): string | null => {
  if (!address || address.trim().length === 0) {
    return null; // Optional field
  }
  const trimmed = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return 'Invalid Ethereum address format (must start with 0x and be 42 characters)';
  }
  return null;
};

export function CreateLightningNodeModal({ open, onOpenChange }: CreateLightningNodeModalProps) {
  const { createNode, joinNode, loading } = useLightningNodes();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // Create form state
  const [selectedChain, setSelectedChain] = useState('ethereumErc4337');
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);

  // Join form state
  const [joinUri, setJoinUri] = useState('');

  // Result state
  const [createdNode, setCreatedNode] = useState<LightningNode | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setActiveTab('create');
        setSelectedChain('ethereumErc4337');
        setSelectedToken('USDC');
        setAmount('');
        setRecipientAddress('');
        setJoinUri('');
        setCreatedNode(null);
        setError(null);
        setSuccess(false);
        setAddressError(null);
        setCopiedUri(false);
      }, 300);
    }
  }, [open]);

  // Validate address on change
  useEffect(() => {
    if (recipientAddress) {
      setAddressError(validateEvmAddress(recipientAddress));
    } else {
      setAddressError(null);
    }
  }, [recipientAddress]);

  const handleCreateNode = async () => {
    setError(null);

    // Validate recipient address if provided
    if (recipientAddress) {
      const addrError = validateEvmAddress(recipientAddress);
      if (addrError) {
        setError(addrError);
        return;
      }
    }

    // Validate chain
    if (!selectedChain) {
      setError('Please select a chain');
      return;
    }

    try {
      const node = await createNode({
        chain: selectedChain,
        token: selectedToken,
        amount: amount || undefined,
        recipientAddress: recipientAddress || undefined,
      });

      if (node) {
        setCreatedNode(node);
        setSuccess(true);
      } else {
        setError('Failed to create Lightning Node');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Lightning Node');
    }
  };

  const handleJoinNode = async () => {
    setError(null);

    if (!joinUri || joinUri.trim().length === 0) {
      setError('Please enter a Lightning Node URI');
      return;
    }

    try {
      const node = await joinNode(joinUri.trim());

      if (node) {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        setError('Failed to join Lightning Node');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join Lightning Node');
    }
  };

  const handleCopyUri = () => {
    if (createdNode?.uri) {
      navigator.clipboard.writeText(createdNode.uri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white text-gray-900 min-h-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <Zap className="h-5 w-5 text-yellow-600" />
            Lightning Node
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Create or join a Lightning Node (Yellow Network Nitrolite Channel) for instant, low-cost
            off-chain transactions.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'create' | 'join')}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-100">
            <TabsTrigger value="create" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600">Create</TabsTrigger>
            <TabsTrigger value="join" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600">Join</TabsTrigger>
          </TabsList>

          {/* Create Tab */}
          <TabsContent value="create" className="space-y-4 mt-4 min-h-[300px]">
            {!createdNode ? (
              <>
                {/* Chain Selector */}
                <div className="space-y-2">
                  <Label htmlFor="chain" className="text-gray-700">Chain</Label>
                  <Select value={selectedChain} onValueChange={setSelectedChain}>
                    <SelectTrigger id="chain" className="bg-white border-gray-300 text-gray-900">
                      <SelectValue placeholder="Select chain" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-gray-900">
                      {SUPPORTED_CHAINS.map((chain) => (
                        <SelectItem key={chain.id} value={chain.id} className="text-gray-900">
                          {chain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Token Selector */}
                <div className="space-y-2">
                  <Label htmlFor="token" className="text-gray-700">Token</Label>
                  <Select value={selectedToken} onValueChange={setSelectedToken}>
                    <SelectTrigger id="token" className="bg-white border-gray-300 text-gray-900">
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-gray-900">
                      {SUPPORTED_TOKENS.map((token) => (
                        <SelectItem key={token} value={token} className="text-gray-900">
                          {token}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-gray-700">Initial Amount (Optional)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                  />
                  <p className="text-xs text-gray-500">
                    You can deposit funds later via the channel resize operation
                  </p>
                </div>

                {/* Recipient Address (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="recipient" className="text-gray-700">Counterparty Address (Optional)</Label>
                  <Input
                    id="recipient"
                    type="text"
                    placeholder="0x..."
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                  />
                  {addressError && (
                    <p className="text-xs text-red-500">{addressError}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Address of the wallet you want to open a channel with
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Success State - Show QR Code and URI */}
                <div className="space-y-4">
                  <div className="flex items-center justify-center text-green-600 mb-2">
                    <CheckCircle2 className="h-12 w-12" />
                  </div>
                  <p className="text-center font-medium text-gray-900">
                    Lightning Node Created!
                  </p>
                  <p className="text-center text-sm text-gray-600">
                    Share this QR code or URI with others to join the channel. Max {createdNode.maxParticipants}{' '}
                    participants.
                  </p>

                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
                      <QRCodeCanvas value={createdNode.uri} size={192} level="H" />
                    </div>
                  </div>

                  {/* URI */}
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-blue-700 font-medium text-sm">Lightning Node URI</span>
                      <button
                        onClick={handleCopyUri}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedUri ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs font-mono text-blue-600 break-all">{createdNode.uri}</p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-xs">
                    <strong>Note:</strong> The channel will become active once at least one other wallet joins. The
                    modal will close automatically when participants join.
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Join Tab */}
          <TabsContent value="join" className="space-y-4 mt-4 min-h-[300px]">
            {!success ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="join-uri" className="text-gray-700">Lightning Node URI</Label>
                  <Input
                    id="join-uri"
                    type="text"
                    placeholder="lightning:..."
                    value={joinUri}
                    onChange={(e) => setJoinUri(e.target.value)}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                  />
                  <p className="text-xs text-gray-500">
                    Paste the URI you received or scan a QR code
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-gray-900 border-gray-300"
                  onClick={() => {
                    // TODO: Implement QR scanner
                    alert('QR Scanner coming soon! Please paste the URI manually for now.');
                  }}
                >
                  <ScanLine className="h-4 w-4 mr-2" />
                  Scan QR Code
                </Button>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4 py-8">
                <div className="flex items-center justify-center text-green-600">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <p className="text-center font-medium text-gray-900">Successfully Joined!</p>
                <p className="text-center text-sm text-gray-600">
                  You have joined the Lightning Node. The channel is now active.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {activeTab === 'create' && !createdNode && (
            <>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading} className="text-gray-900 border-gray-300">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateNode}
                disabled={loading || !!addressError}
                className="bg-black hover:bg-gray-800 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Create
                  </>
                )}
              </Button>
            </>
          )}

          {activeTab === 'create' && createdNode && (
            <Button type="button" onClick={handleClose} className="w-full bg-black hover:bg-gray-800 text-white">
              Done
            </Button>
          )}

          {activeTab === 'join' && !success && (
            <>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading} className="text-gray-900 border-gray-300 hover:bg-gray-50">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleJoinNode}
                disabled={loading || !joinUri.trim()}
                className="!bg-black hover:!bg-gray-800 !text-white disabled:!bg-black disabled:!opacity-100 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join'
                )}
              </Button>
            </>
          )}

          {activeTab === 'join' && success && (
            <Button type="button" onClick={handleClose} className="w-full bg-black hover:bg-gray-800 text-white">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

