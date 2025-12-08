'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  lightningNodeApi, 
  LightningNode, 
  CreateLightningNodeRequest,
  JoinLightningNodeRequest 
} from '@/lib/api';
import { useAuth } from './useAuth';

/**
 * Hook to manage Lightning Nodes (Yellow Network Nitrolite Channels)
 * Provides state management for viewing, creating, and joining channels
 */
export function useLightningNodes() {
  const { userId } = useAuth();
  const [nodes, setNodes] = useState<LightningNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  /**
   * Fetch all Lightning Nodes for the current user
   */
  const fetchNodes = useCallback(async () => {
    if (!userId) {
      setNodes([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await lightningNodeApi.getLightningNodes(userId);
      setNodes(response.nodes);
      setLastFetched(Date.now());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch Lightning Nodes';
      setError(errorMessage);
      console.error('Error fetching Lightning Nodes:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * Create a new Lightning Node
   */
  const createNode = useCallback(async (
    data: Omit<CreateLightningNodeRequest, 'userId'>
  ): Promise<LightningNode | null> => {
    if (!userId) {
      throw new Error('User ID is required to create a Lightning Node');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await lightningNodeApi.createLightningNode({
        ...data,
        userId,
      });

      if (response.ok && response.node) {
        // Add the new node to the list
        setNodes((prev) => [response.node, ...prev]);
        setLastFetched(Date.now());
        return response.node;
      }

      throw new Error('Failed to create Lightning Node');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create Lightning Node';
      setError(errorMessage);
      console.error('Error creating Lightning Node:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * Join an existing Lightning Node by URI
   */
  const joinNode = useCallback(async (uri: string): Promise<LightningNode | null> => {
    if (!userId) {
      throw new Error('User ID is required to join a Lightning Node');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await lightningNodeApi.joinLightningNode({
        userId,
        uri,
      });

      if (response.ok && response.node) {
        // Add the joined node to the list
        setNodes((prev) => [response.node, ...prev]);
        setLastFetched(Date.now());
        return response.node;
      }

      throw new Error('Failed to join Lightning Node');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join Lightning Node';
      setError(errorMessage);
      console.error('Error joining Lightning Node:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * Refresh nodes list
   */
  const refreshNodes = useCallback(() => {
    return fetchNodes();
  }, [fetchNodes]);

  // Fetch nodes on mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchNodes();
    }
  }, [userId, fetchNodes]);

  return {
    nodes,
    loading,
    error,
    lastFetched,
    fetchNodes,
    createNode,
    joinNode,
    refreshNodes,
  };
}

