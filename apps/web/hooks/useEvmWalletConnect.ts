'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WalletKit, IWalletKit } from '@reown/walletkit';
import { Core } from '@walletconnect/core';
import { SessionTypes } from '@walletconnect/types';
import { walletApi } from '@/lib/api';
import { createLogger, getTraceId } from '@/utils/logger';
import { metrics } from '@/utils/metrics';
import {
  trackWalletConnectInitialized,
  trackWalletConnectProposalReceived,
  trackWalletConnectSessionApproved,
  trackWalletConnectSessionRejected,
  trackWalletConnectRequestReceived,
  trackWalletConnectRequestSigned,
  trackWalletConnectRequestRejected,
  trackWalletConnectSessionDisconnected,
  trackWalletConnectPairingSuccess,
  trackWalletConnectApprovalFailed,
  trackWalletConnectSigningFailed,
} from '@/lib/mixpanel-events';

const logger = createLogger('evm-walletconnect');

export interface EvmWalletConnectSession {
  topic: string;
  peer: {
    metadata?: {
      name?: string;
      description?: string;
      url?: string;
      icons?: string[];
    };
  };
  namespaces: SessionTypes.Namespaces;
}

export interface UseEvmWalletConnectReturn {
  client: IWalletKit | null;
  sessions: EvmWalletConnectSession[];
  isInitializing: boolean;
  error: string | null;
  pair: (uri: string) => Promise<void>;
  disconnect: (topic: string) => Promise<void>;
  approveSession: (proposalId: number, namespaces: SessionTypes.Namespaces) => Promise<void>;
  rejectSession: (proposalId: number) => Promise<void>;
  initialize: () => Promise<void>;
}

// Global client instance to prevent multiple initializations
let globalWalletKit: IWalletKit | null = null;
let isInitializingGlobal = false;

export function useEvmWalletConnect(userId: string | null): UseEvmWalletConnectReturn {
  const [client, setClient] = useState<IWalletKit | null>(null);
  const [sessions, setSessions] = useState<EvmWalletConnectSession[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  const initialize = useCallback(async () => {
    if (!userId) {
      setIsInitializing(false);
      return;
    }

    // Use existing client if available
    if (globalWalletKit) {
      setClient(globalWalletKit);
      setIsInitializing(false);
      isInitializedRef.current = true;
      const existingSessions = globalWalletKit.getActiveSessions();
      setSessions(Object.values(existingSessions));
      return;
    }

    if (isInitializedRef.current || isInitializingGlobal) {
      setIsInitializing(false);
      return;
    }

    isInitializingGlobal = true;
    setIsInitializing(true);

    try {
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      if (!projectId) {
        throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set');
      }

      // Initialize Core first
      const core = new Core({
        projectId,
      });

      // Initialize WalletKit with Core
      const walletKit = await WalletKit.init({
        core,
        metadata: {
          name: 'Tempwallets',
          description: 'Your Secure Multi-Chain Wallet',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://tempwallets.com',
          icons: [`${typeof window !== 'undefined' ? window.location.origin : 'https://tempwallets.com'}/tempwallets-logo.png`],
        },
      });

      globalWalletKit = walletKit;
      setClient(walletKit);
      setIsInitializing(false);
      isInitializedRef.current = true;
      isInitializingGlobal = false;

      // Load existing sessions
      const existingSessions = walletKit.getActiveSessions();
      setSessions(Object.values(existingSessions));

      // Track WalletConnect initialization
      trackWalletConnectInitialized({ userId });

      // Listen for session proposals
      walletKit.on('session_proposal', async (proposal) => {
        // Session proposal received - only log errors

        // Save proposal to backend
        await walletApi.saveWcProposal(
          userId,
          proposal.id,
          proposal.params.proposer,
          proposal.params.requiredNamespaces,
          proposal.params.optionalNamespaces,
          new Date(proposal.params.expiryTimestamp * 1000),
        );

        // Track proposal received
        const eip155Required = proposal.params.requiredNamespaces?.eip155;
        const eip155Optional = proposal.params.optionalNamespaces?.eip155;
        trackWalletConnectProposalReceived({
          userId,
          proposalId: proposal.id,
          dappName: proposal.params.proposer.metadata?.name || 'Unknown',
          dappUrl: proposal.params.proposer.metadata?.url || 'Unknown',
          requiredChains: eip155Required?.chains || [],
          optionalChains: eip155Optional?.chains || [],
        });

        // Show approval dialog
        const approved = window.confirm(
          `Connect your Tempwallet to ${proposal.params.proposer.metadata?.name || 'Unknown DApp'}?\n\n` +
          `URL: ${proposal.params.proposer.metadata?.url || 'Unknown'}\n\n` +
          `This will allow the dApp to request transactions from your Tempwallet.`
        );

        if (approved) {
          try {
            // ✅ FIXED: Handle chains from multiple sources
            const eip155Required = proposal.params.requiredNamespaces?.eip155;
            const eip155Optional = proposal.params.optionalNamespaces?.eip155;

            // Get chains from both required and optional
            const requiredChains = eip155Required?.chains || [];
            const optionalChains = eip155Optional?.chains || [];

            // Combine all requested chains
            let allChains = [...requiredChains, ...optionalChains];

            // Remove duplicates
            allChains = [...new Set(allChains)];

            // Extract chain IDs (convert "eip155:1" -> 1)
            let approvedChainIds: number[] = allChains
              .filter((c: string) => c.startsWith('eip155:'))
              .map((c: string) => {
                const parts = c.split(':');
                if (parts.length < 2 || !parts[1]) {
                  return null;
                }
                const chainId = parseInt(parts[1], 10);
                return isNaN(chainId) ? null : chainId;
              })
              .filter((id): id is number => id !== null);

            // ✅ CRITICAL: If no chains specified, use ALL user's chains
            if (approvedChainIds.length === 0) {
              // Get user's EIP-7702 accounts
              const accountsResponse = await walletApi.getWcAccounts(userId);

              // Extract unique chain IDs
              approvedChainIds = [...new Set(
                accountsResponse.accounts.map((acc: { chainId: number }) => acc.chainId)
              )];
            }

            // Ensure we have at least one chain
            if (approvedChainIds.length === 0) {
              throw new Error('No chains available. Please create a wallet first.');
            }

            // Request approval from backend
            const { namespaces, session: sessionData } = await walletApi.approveWcProposal(
              userId,
              proposal.id,
              approvedChainIds,
            );

            // Approve on WalletKit
            const { topic } = await walletKit.approveSession({
              id: proposal.id,
              namespaces,
            });

            // Save full session to backend
            const sessions = walletKit.getActiveSessions();
            const session = sessions[topic];
            if (session) {
              await walletApi.saveWcSession(userId, session, namespaces);
            }

            // Update local sessions
            setSessions(Object.values(walletKit.getActiveSessions()));

            // Track session approval
            const accountsResponse = await walletApi.getWcAccounts(userId);
            const hasEip7702 = accountsResponse.accounts.some((acc: any) => acc.hasEip7702);
            trackWalletConnectSessionApproved({
              userId,
              proposalId: proposal.id,
              dappName: proposal.params.proposer.metadata?.name || 'Unknown',
              dappUrl: proposal.params.proposer.metadata?.url || 'Unknown',
              approvedChains: approvedChainIds,
              accountCount: accountsResponse.accounts.length,
              hasEip7702,
            });

            metrics.increment('walletconnect.session.approved', { namespace: 'eip155' });
          } catch (err) {
            logger.error('Failed to approve session', err as Error);

            // Track approval failure
            trackWalletConnectApprovalFailed({
              userId,
              proposalId: proposal.id,
              dappName: proposal.params.proposer.metadata?.name || 'Unknown',
              errorMessage: err instanceof Error ? err.message : 'Failed to approve',
            });

            await walletApi.rejectWcProposal(userId, proposal.id, err instanceof Error ? err.message : 'Failed to approve');
            await walletKit.rejectSession({
              id: proposal.id,
              reason: {
                code: 5000,
                message: err instanceof Error ? err.message : 'Failed to approve session',
              },
            });
          }
        } else {
          // Track session rejection
          trackWalletConnectSessionRejected({
            userId,
            proposalId: proposal.id,
            dappName: proposal.params.proposer.metadata?.name || 'Unknown',
            reason: 'User rejected',
          });

          await walletApi.rejectWcProposal(userId, proposal.id, 'User rejected');
          await walletKit.rejectSession({
            id: proposal.id,
            reason: {
              code: 5000,
              message: 'User rejected',
            },
          });
        }
      });

      // Listen for session requests
      walletKit.on('session_request', async (event) => {
        // Session request received - only log errors

        const { id, topic, params } = event;
        const { request, chainId } = params;

        // Get dApp name from session
        const sessions = walletKit.getActiveSessions();
        const session = sessions[topic];
        const dappName = session?.peer.metadata?.name || 'Unknown';

        // Track request received
        trackWalletConnectRequestReceived({
          userId,
          requestId: id,
          dappName,
          method: request.method,
          chainId,
        });

        const requestStartTime = Date.now();

        try {
          // Show confirmation dialog
          const confirmed = window.confirm(
            `Sign ${request.method}?\n\n` +
            `Chain: ${chainId}\n` +
            `Method: ${request.method}\n\n` +
            `Review details carefully before confirming.`
          );

          if (!confirmed) {
            throw new Error('User rejected request');
          }

          // Request signature from backend
          const { signature } = await walletApi.signWcRequest(
            userId,
            topic,
            id,
            request.method,
            request.params,
            chainId,
          );

          // Send response
          await walletKit.respondSessionRequest({
            topic,
            response: {
              id,
              jsonrpc: '2.0',
              result: signature,
            },
          });

          // Track successful signing
          const signatureDuration = Date.now() - requestStartTime;
          trackWalletConnectRequestSigned({
            userId,
            requestId: id,
            dappName,
            method: request.method,
            chainId,
            signatureDuration,
          });

          // Request signed successfully
          metrics.increment('walletconnect.request.success', { method: request.method });
        } catch (err) {
          logger.error('Failed to sign request', err as Error);

          const errorMessage = err instanceof Error ? err.message : 'Failed to sign';
          const isUserRejection = errorMessage.includes('rejected');

          // Track signing failure
          if (isUserRejection) {
            trackWalletConnectRequestRejected({
              userId,
              requestId: id,
              dappName,
              method: request.method,
              reason: errorMessage,
            });
          } else {
            trackWalletConnectSigningFailed({
              userId,
              requestId: id,
              dappName,
              method: request.method,
              errorMessage,
            });
          }

          await walletKit.respondSessionRequest({
            topic,
            response: {
              id,
              jsonrpc: '2.0',
              error: {
                code: 5000,
                message: errorMessage,
              },
            },
          });
          metrics.increment('walletconnect.request.failed', {
            method: request.method,
            reason: errorMessage,
          });
        }
      });

      // Listen for session delete
      walletKit.on('session_delete', async (event) => {
        // Session deleted - only log errors

        // Get dApp name before deletion
        const sessions = walletKit.getActiveSessions();
        const session = sessions[event.topic];
        const dappName = session?.peer.metadata?.name || 'Unknown';

        // Track session disconnection (initiated by dApp)
        trackWalletConnectSessionDisconnected({
          userId,
          topic: event.topic,
          dappName,
          initiatedBy: 'dapp',
        });

        try {
          await walletApi.disconnectWcSession(userId, event.topic);
        } catch (err) {
          logger.warn('Failed to delete session from backend', {
            error: err instanceof Error ? err.message : 'Unknown error',
            topic: event.topic,
          });
        }

        setSessions(Object.values(walletKit.getActiveSessions()));
        metrics.increment('walletconnect.session.deleted');
      });

    } catch (err) {
      logger.error('WalletKit initialization failed', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize WalletConnect');
      setIsInitializing(false);
      isInitializingGlobal = false;
      metrics.increment('walletconnect.init.failed');
    }
  }, [userId]);

  // Auto-initialize if client already exists
  useEffect(() => {
    if (!userId) {
      setIsInitializing(false);
      return;
    }

    if (globalWalletKit) {
      setClient(globalWalletKit);
      setIsInitializing(false);
      const existingSessions = globalWalletKit.getActiveSessions();
      setSessions(Object.values(existingSessions));
    } else {
      setIsInitializing(false);
    }
  }, [userId]);

  const pair = useCallback(async (uri: string) => {
    if (!client) {
      throw new Error('WalletKit not initialized');
    }

    if (!uri.startsWith('wc:')) {
      throw new Error('Invalid WalletConnect URI');
    }

    try {
      await client.pair({ uri });

      // Track pairing success
      trackWalletConnectPairingSuccess({
        userId: userId || '',
        method: 'uri',
      });

      // Paired successfully
      metrics.increment('walletconnect.pair.success');
    } catch (err) {
      logger.error('Pairing failed', err);
      metrics.increment('walletconnect.pair.failed');
      throw err;
    }
  }, [client]);

  const disconnect = useCallback(async (topic: string) => {
    if (!client) {
      throw new Error('WalletKit not initialized');
    }

    // Get dApp name before disconnection
    const sessions = client.getActiveSessions();
    const session = sessions[topic];
    const dappName = session?.peer.metadata?.name || 'Unknown';

    try {
      await client.disconnectSession({
        topic,
        reason: {
          code: 6000,
          message: 'User disconnected',
        },
      });

      // Track user-initiated disconnection
      trackWalletConnectSessionDisconnected({
        userId: userId || '',
        topic,
        dappName,
        initiatedBy: 'user',
      });

      // Also disconnect from backend
      try {
        await walletApi.disconnectWcSession(userId || '', topic);
      } catch (err) {
        logger.warn('Failed to disconnect from backend', {
          error: err instanceof Error ? err.message : 'Unknown error',
          topic,
        });
      }

      setSessions(Object.values(client.getActiveSessions()));
      // Disconnected successfully
      metrics.increment('walletconnect.disconnect.success');
    } catch (err) {
      logger.error('Disconnect failed', err);
      metrics.increment('walletconnect.disconnect.failed');
      throw err;
    }
  }, [client, userId]);

  const approveSession = useCallback(async (proposalId: number, namespaces: SessionTypes.Namespaces) => {
    if (!client) {
      throw new Error('WalletKit not initialized');
    }

    try {
      const { topic } = await client.approveSession({
        id: proposalId,
        namespaces,
      });

      const sessions = client.getActiveSessions();
      const session = sessions[topic];
      if (session) {
        await walletApi.saveWcSession(userId || '', session, namespaces);
      }

      setSessions(Object.values(client.getActiveSessions()));
      metrics.increment('walletconnect.session.approved_manual');
    } catch (err) {
      logger.error('Approve session failed', err);
      metrics.increment('walletconnect.session.approve_failed_manual');
      throw err;
    }
  }, [client, userId]);

  const rejectSession = useCallback(async (proposalId: number) => {
    if (!client) {
      throw new Error('WalletKit not initialized');
    }

    try {
      await walletApi.rejectWcProposal(userId || '', proposalId);
      await client.rejectSession({
        id: proposalId,
        reason: {
          code: 5000,
          message: 'User rejected the connection',
        },
      });
      metrics.increment('walletconnect.session.rejected_manual');
    } catch (err) {
      logger.error('Reject session failed', err);
      metrics.increment('walletconnect.session.reject_failed');
      throw err;
    }
  }, [client, userId]);

  return {
    client,
    sessions,
    isInitializing,
    error,
    pair,
    disconnect,
    approveSession,
    rejectSession,
    initialize,
  };
}
