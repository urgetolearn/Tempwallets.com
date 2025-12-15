'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, Zap, Copy, QrCode } from 'lucide-react';
import { useLightningNodes } from '@/hooks/useLightningNodes';
import { CreateLightningNodeModal } from './create-lightning-node-modal';
import { LightningNode } from '@/lib/api';

const CHAIN_NAMES: Record<string, string> = {
  ethereum: 'Ethereum',
  base: 'Base',
  arbitrum: 'Arbitrum',
  polygon: 'Polygon',
};

/**
 * Lightning Node Card Component
 * Displays information about a single Lightning Node (Nitrolite Channel)
 */
function LightningNodeCard({ node }: { node: LightningNode }) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  const handleCopyChannelId = () => {
    navigator.clipboard.writeText(node.channelId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyUri = () => {
    navigator.clipboard.writeText(node.uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const statusColor = {
    open: 'bg-green-100 text-green-800',
    joining: 'bg-yellow-100 text-yellow-800',
    closing: 'bg-orange-100 text-orange-800',
    closed: 'bg-gray-100 text-gray-800',
  }[node.status];

  const statusText = {
    open: 'Open',
    joining: 'Joining',
    closing: 'Closing',
    closed: 'Closed',
  }[node.status];

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-200">
      {/* Header with Status */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-100 p-2 rounded-lg">
            <Zap className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-rubik-medium text-gray-900">
              {CHAIN_NAMES[node.chain] || node.chain}
            </h3>
            <p className="text-sm text-gray-500">{node.token}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {statusText}
        </span>
      </div>

      {/* Balance */}
      <div className="bg-white rounded-xl p-3">
        <p className="text-xs text-gray-500 mb-1">Channel Balance</p>
        <p className="text-lg font-rubik-medium text-gray-900">
          {node.balanceHuman} {node.token}
        </p>
      </div>

      {/* Participants */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Participants</span>
        <span className="font-rubik-medium text-gray-900">
          {node.participantCount} / {node.maxParticipants}
        </span>
      </div>

      {/* Channel ID */}
      <div className="bg-white rounded-xl p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500">Channel ID</p>
          <button
            onClick={handleCopyChannelId}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Copy className="h-3 w-3" />
            {copiedId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs font-mono text-gray-700 break-all">
          {node.channelId}
        </p>
      </div>

      {/* Lightning URI (for sharing) */}
      {node.status === 'joining' && (
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-blue-700 font-medium">Share to join</p>
            <button
              onClick={handleCopyUri}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Copy className="h-3 w-3" />
              {copiedUri ? 'Copied!' : 'Copy URI'}
            </button>
          </div>
          <p className="text-xs font-mono text-blue-600 break-all">
            {node.uri}
          </p>
        </div>
      )}

      {/* Created Date */}
      <div className="text-xs text-gray-500">
        Created {new Date(node.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

/**
 * Lightning Nodes View Component
 * Displays all Lightning Nodes and allows creating new ones
 */
export function LightningNodesView() {
  const { nodes, loading, error } = useLightningNodes();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Show loading state
  if (loading && nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
        <p className="text-gray-500 font-rubik-normal">Loading Lightning Nodes...</p>
      </div>
    );
  }

  // Show error state
  if (error && nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 md:py-20">
        <div className="text-red-500 mb-4">⚠️</div>
        <p className="text-gray-600 text-lg font-rubik-medium mb-2">
          Failed to load Lightning Nodes
        </p>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  // Show empty state
  if (nodes.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 md:py-20">
          {/* Empty state illustration */}
          <div className="-mt-32">
            <Image
              src="/empty-mailbox-illustration-with-spiderweb-and-flie-2025-10-20-04-28-09-utc.gif"
              alt="No Lightning Nodes"
              width={320}
              height={320}
              className="object-contain mix-blend-multiply"
            />
          </div>
          <p className="text-gray-600 text-lg md:text-xl font-rubik-medium z-10 -mt-16 mb-4">
            No Lightning Node Available
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="bg-black text-white px-6 py-3 rounded-xl font-rubik-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Create Lightning Node
          </button>
        </div>

        <CreateLightningNodeModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
        />
      </>
    );
  }

  // Show list of Lightning Nodes
  return (
    <>
      <div className="space-y-4">
        {/* Create button at top when nodes exist */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="bg-black text-white px-4 py-2 rounded-xl font-rubik-medium hover:bg-gray-800 transition-colors flex items-center gap-2 text-sm"
          >
            <Zap className="h-4 w-4" />
            New Node
          </button>
        </div>

        {/* Lightning Nodes List */}
        {nodes.map((node) => (
          <LightningNodeCard key={node.channelId} node={node} />
        ))}
      </div>

      <CreateLightningNodeModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </>
  );
}

