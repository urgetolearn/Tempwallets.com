'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { walletApi, ApiError, WalletConnectNamespacePayload } from '@/lib/api';

const DEFAULT_WALLETCONNECT_METHODS = [
  'eth_sendTransaction',
  'eth_signTransaction',
  'eth_sign',
  'personal_sign',
];

const DEFAULT_WALLETCONNECT_EVENTS = ['chainChanged', 'accountsChanged'];

const SUPPORTED_WALLETCONNECT_CHAINS = [
  'eip155:1',
  'eip155:8453',
  'eip155:42161',
  'eip155:137',
  'eip155:43114',
];

export interface WalletConnectSession {
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

export interface UseWalletConnectReturn {
  client: SignClient | null;
  sessions: WalletConnectSession[];
  isInitializing: boolean;
  error: string | null;
  pair: (uri: string) => Promise<void>;
  disconnect: (topic: string) => Promise<void>;
  approveSession: (proposalId: number, namespaces: SessionTypes.Namespaces) => Promise<void>;
  rejectSession: (proposalId: number) => Promise<void>;
}

export function useWalletConnect(userId: string | null): UseWalletConnectReturn {
  const [client, setClient] = useState<SignClient | null>(null);
  const [sessions, setSessions] = useState<WalletConnectSession[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pendingProposalsRef = useRef<Map<number, any>>(new Map());

  // Initialize WalletConnect client
  useEffect(() => {
    if (!userId) {
      setIsInitializing(false);
      return;
    }

    const initClient = async () => {
      try {
        const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
        if (!projectId) {
          throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set in environment variables');
        }

        const signClient = await SignClient.init({
          projectId,
          metadata: {
            name: 'Tempwallets',
            description: 'Temporary wallet service',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://tempwallets.com',
            icons: [`${typeof window !== 'undefined' ? window.location.origin : 'https://tempwallets.com'}/tempwallets-logo.png`],
          },
        });

        setClient(signClient);
        setIsInitializing(false);

        // Load existing sessions
        const existingSessions = signClient.session.getAll();
        setSessions(existingSessions.map(s => ({
          topic: s.topic,
          peer: s.peer,
          namespaces: s.namespaces,
        })));

        // Listen for session proposals
        signClient.on('session_proposal', async (event) => {
          console.log('WalletConnect session proposal received:', event);
          const { id, params } = event;
          pendingProposalsRef.current.set(id, params);
          
          // Log the full proposal structure for debugging
          console.log('Session proposal details:', {
            requiredNamespaces: params.requiredNamespaces,
            optionalNamespaces: params.optionalNamespaces,
            proposer: params.proposer,
            relays: params.relays,
          });
          
          // Auto-approve session proposals (you can add user confirmation UI here)
          try {
            const fetchWalletConnectNamespace = async (): Promise<WalletConnectNamespacePayload> => {
              try {
                return await walletApi.getWalletConnectAccounts(userId);
              } catch (err) {
                if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
                  console.log('WalletConnect accounts not ready, creating wallet...');
                  await walletApi.createOrImportSeed({ userId, mode: 'random' });
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  return await walletApi.getWalletConnectAccounts(userId);
                }
                throw err;
              }
            };

            const namespacePayload = await fetchWalletConnectNamespace();
            console.log('Fetched WalletConnect namespace payload:', namespacePayload);

            const namespaces: SessionTypes.Namespaces = {};
            const requestedChains: string[] = [];
            const allRequestedChains: string[] = [];
            const unsupportedChains: Set<string> = new Set();

            const extractChains = (namespaceKey: string, namespaceData: any): string[] => {
              if (Array.isArray(namespaceData?.chains)) {
                return namespaceData.chains;
              }
              if (typeof namespaceData?.chains === 'string') {
                return [namespaceData.chains];
              }
              if (Array.isArray(namespaceData?.accounts)) {
                return namespaceData.accounts
                  .map((acc: string) => {
                    const parts = acc.split(':');
                    return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : null;
                  })
                  .filter((c: string | null): c is string => c !== null);
              }
              if (namespaceKey === namespacePayload.namespace && namespacePayload.chains.length > 0) {
                console.log(`No chains specified for ${namespaceKey}, defaulting to backend-supported chains`);
                return namespacePayload.chains;
              }
              return [];
            };

            // Helper function to process a namespace (required or optional)
            const processNamespace = (namespaceKey: string, namespaceData: any, isRequired: boolean) => {
              if (namespaceKey !== namespacePayload.namespace) {
                console.warn(`Unsupported namespace ${namespaceKey}. Supported namespace: ${namespacePayload.namespace}`);
                return;
              }

              const chains = extractChains(namespaceKey, namespaceData);

              if (chains.length === 0) {
                console.warn(`No chains found for namespace ${namespaceKey}`, namespaceData);
                return;
              }

              console.log(`Processing ${isRequired ? 'required' : 'optional'} namespace ${namespaceKey} with chains:`, chains);

              chains.forEach((chain) => allRequestedChains.push(chain));

              const supportedChains = chains.filter((chain) => {
                const isSupported = SUPPORTED_WALLETCONNECT_CHAINS.includes(chain);
                if (!isSupported) {
                  unsupportedChains.add(chain);
                }
                return isSupported;
              });

              const filteredOutChains = chains.filter((chain) => !SUPPORTED_WALLETCONNECT_CHAINS.includes(chain));

              if (filteredOutChains.length > 0) {
                console.warn(
                  `Filtering out unsupported chains for namespace ${namespaceKey}: ${filteredOutChains.join(', ')}`,
                );
              }

              if (supportedChains.length === 0) {
                if (isRequired) {
                  throw new Error(
                    `DApp requested chains (${chains.join(
                      ', ',
                    )}) that are not currently supported. Supported chains: ${SUPPORTED_WALLETCONNECT_CHAINS.join(', ')}.`,
                  );
                }
                console.warn(
                  `Skipping namespace ${namespaceKey} because no supported chains were requested (chains: ${chains.join(', ')})`,
                );
                return;
              }

              const accounts: string[] = [];
              const missingForNamespace: string[] = [];

              supportedChains.forEach((chain: string) => {
                requestedChains.push(chain);
                const address = namespacePayload.addressesByChain[chain];
                if (address) {
                  accounts.push(`${chain}:${address}`);
                  console.log(`Mapped chain ${chain} to address: ${address}`);
                } else {
                  missingForNamespace.push(chain);
                  unsupportedChains.add(chain);
                  console.warn(`No address available for chain ${chain}. Supported chains:`, namespacePayload.chains);
                }
              });

              if (accounts.length > 0) {
                namespaces[namespaceKey] = {
                  chains: supportedChains,
                  accounts,
                  methods:
                    Array.isArray(namespaceData.methods) && namespaceData.methods.length > 0
                      ? namespaceData.methods
                      : DEFAULT_WALLETCONNECT_METHODS,
                  events:
                    Array.isArray(namespaceData.events) && namespaceData.events.length > 0
                      ? namespaceData.events
                      : DEFAULT_WALLETCONNECT_EVENTS,
                };
                console.log(`Added namespace ${namespaceKey} with ${accounts.length} account(s)`);
              } else {
                console.warn(`No accounts found for namespace ${namespaceKey} (requested chains: ${chains.join(', ')})`);
              }

              if (missingForNamespace.length > 0) {
                console.warn(`Missing accounts for chains: ${missingForNamespace.join(', ')}`);
              }
            };

            // Process required namespaces first
            if (params.requiredNamespaces) {
              Object.keys(params.requiredNamespaces).forEach((key) => {
                processNamespace(key, params.requiredNamespaces[key], true);
              });
            }

            // Process optional namespaces if no accounts were found in required namespaces
            if (Object.keys(namespaces).length === 0 && params.optionalNamespaces) {
              console.log('No accounts found in required namespaces, checking optional namespaces...');
              Object.keys(params.optionalNamespaces).forEach((key) => {
                if (!namespaces[key]) {
                  processNamespace(key, params.optionalNamespaces[key], false);
                }
              });
            }

            if (unsupportedChains.size > 0) {
              const unsupportedList = Array.from(unsupportedChains);
              const errorMsg = `DApp requested unsupported chains: ${unsupportedList.join(
                ', ',
              )}. Please disable those networks and reconnect. Supported chains: ${SUPPORTED_WALLETCONNECT_CHAINS.join(
                ', ',
              )}.`;
              console.error(errorMsg, {
                namespacePayload,
                allRequestedChains,
                unsupportedChains: unsupportedList,
                requiredNamespaces: params.requiredNamespaces,
                optionalNamespaces: params.optionalNamespaces,
              });
              throw new Error(errorMsg);
            }

            const hasValidNamespaces =
              Object.keys(namespaces).length > 0 &&
              Object.values(namespaces).some((ns) => ns.accounts && ns.accounts.length > 0);

            if (!hasValidNamespaces) {
              const errorMsg = `No valid accounts found for requested chains: ${
                requestedChains.length > 0 ? requestedChains.join(', ') : 'none specified'
              }. Supported chains: ${SUPPORTED_WALLETCONNECT_CHAINS.join(', ')}.`;
              console.error(errorMsg, {
                namespacePayload,
                requestedChains,
                unsupportedChains: Array.from(unsupportedChains),
                requiredNamespaces: params.requiredNamespaces,
                optionalNamespaces: params.optionalNamespaces,
              });
              throw new Error(errorMsg);
            }

            // For now, auto-approve. In production, show confirmation UI
            await signClient.approve({
              id,
              namespaces,
            });

            pendingProposalsRef.current.delete(id);
          } catch (err) {
            console.error('Error approving session:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to approve session';
            setError(errorMessage);
            
            // Reject the proposal if approval failed
            try {
              await signClient.reject({
                id,
                reason: {
                  code: 6001,
                  message: errorMessage,
                },
              });
            } catch (rejectErr) {
              console.error('Error rejecting session:', rejectErr);
            }
            
            pendingProposalsRef.current.delete(id);
          }
        });

        // Listen for session requests (transaction signing)
        signClient.on('session_request', async (event) => {
          console.log('WalletConnect session request received:', event);
          const { id, topic, params } = event;
          const { request } = params;
          const { method, params: requestParams } = request;

          try {
            if (method === 'eth_sendTransaction') {
              const tx = Array.isArray(requestParams) ? requestParams[0] : requestParams;
              
              if (!userId) {
                throw new Error('User ID is required');
              }

              // Get chain ID from the request
              const chainId = tx.chainId 
                ? (typeof tx.chainId === 'string' ? tx.chainId : `eip155:${tx.chainId}`)
                : 'eip155:1'; // Default to Ethereum

              // Call backend to sign transaction
              const result = await walletApi.signWalletConnectTransaction({
                userId,
                chainId,
                from: tx.from,
                to: tx.to,
                value: tx.value,
                data: tx.data,
                gas: tx.gas,
                gasPrice: tx.gasPrice,
                maxFeePerGas: tx.maxFeePerGas,
                maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
                nonce: tx.nonce,
              });

              const txHash = result.txHash;

              // Respond to WalletConnect with transaction hash
              await signClient.respond({
                topic,
                response: {
                  id,
                  jsonrpc: '2.0',
                  result: txHash,
                },
              });

              console.log('Transaction signed and sent:', txHash);
            } else {
              // Unsupported method
              await signClient.respond({
                topic,
                response: {
                  id,
                  jsonrpc: '2.0',
                  error: {
                    code: -32601,
                    message: `Method ${method} not supported`,
                  },
                },
              });
            }
          } catch (err) {
            console.error('Error handling session request:', err);
            
            // Send error response
            try {
              await signClient.respond({
                topic,
                response: {
                  id,
                  jsonrpc: '2.0',
                  error: {
                    code: -32000,
                    message: err instanceof Error ? err.message : 'Unknown error',
                  },
                },
              });
            } catch (respondError) {
              console.error('Error sending error response:', respondError);
            }
          }
        });

        // Listen for session deletions
        signClient.on('session_delete', () => {
          console.log('Session deleted');
          const updatedSessions = signClient.session.getAll();
          setSessions(updatedSessions.map(s => ({
            topic: s.topic,
            peer: s.peer,
            namespaces: s.namespaces,
          })));
        });
      } catch (err) {
        console.error('Error initializing WalletConnect:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize WalletConnect');
        setIsInitializing(false);
      }
    };

    initClient();
  }, [userId]);

  // Update sessions when client changes
  useEffect(() => {
    if (client) {
      const updateSessions = () => {
        const allSessions = client.session.getAll();
        setSessions(allSessions.map(s => ({
          topic: s.topic,
          peer: s.peer,
          namespaces: s.namespaces,
        })));
      };

      updateSessions();
      
      // Set up interval to check for session changes
      const interval = setInterval(updateSessions, 1000);
      return () => clearInterval(interval);
    }
  }, [client]);

  const pair = useCallback(async (uri: string) => {
    if (!client) {
      throw new Error('WalletConnect client not initialized');
    }

    try {
      setError(null);
      await client.pair({ uri });
      console.log('Successfully paired with DApp');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pair with DApp';
      console.error('Error pairing:', err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [client]);

  const disconnect = useCallback(async (topic: string) => {
    if (!client) {
      throw new Error('WalletConnect client not initialized');
    }

    try {
      setError(null);
      await client.disconnect({
        topic,
        reason: {
          code: 6000,
          message: 'User disconnected',
        },
      });
      
      // Update sessions
      const updatedSessions = client.session.getAll();
      setSessions(updatedSessions.map(s => ({
        topic: s.topic,
        peer: s.peer,
        namespaces: s.namespaces,
      })));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect';
      console.error('Error disconnecting:', err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [client]);

  const approveSession = useCallback(async (proposalId: number, namespaces: SessionTypes.Namespaces) => {
    if (!client) {
      throw new Error('WalletConnect client not initialized');
    }

    try {
      setError(null);
      await client.approve({
        id: proposalId,
        namespaces,
      });
      pendingProposalsRef.current.delete(proposalId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve session';
      console.error('Error approving session:', err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [client]);

  const rejectSession = useCallback(async (proposalId: number) => {
    if (!client) {
      throw new Error('WalletConnect client not initialized');
    }

    try {
      setError(null);
      await client.reject({
        id: proposalId,
        reason: {
          code: 6001,
          message: 'User rejected',
        },
      });
      pendingProposalsRef.current.delete(proposalId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject session';
      console.error('Error rejecting session:', err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [client]);

  return {
    client,
    sessions,
    isInitializing,
    error,
    pair,
    disconnect,
    approveSession,
    rejectSession,
  };
}

