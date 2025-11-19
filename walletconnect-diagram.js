/**
 * WalletConnect Multi-Chain Architecture - Visual Sequence Diagrams
 * 
 * This file contains Mermaid.js diagrams that visualize the flow of the
 * modular WalletConnect architecture supporting multiple blockchain namespaces.
 * 
 * To view these diagrams:
 * 1. Copy the Mermaid code
 * 2. Visit https://mermaid.live/
 * 3. Paste the code to see the interactive diagram
 * 
 * Or use a Mermaid extension in VS Code
 */

// ============================================================================
// DIAGRAM 1: Overall Architecture Overview
// ============================================================================

const architectureOverview = `
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#1e3a8a','primaryTextColor':'#fff','primaryBorderColor':'#3b82f6','lineColor':'#6366f1','secondaryColor':'#10b981','tertiaryColor':'#f59e0b'}}}%%

graph TB
    subgraph "Frontend Layer"
        UI[User Interface Components]
        MCH[useMultiChainWalletConnect Hook]
        
        subgraph "Namespace Hooks"
            EVMHook[useEvmWalletConnect<br/>EIP155 Namespace]
            SubHook[useSubstrateWalletConnect<br/>Polkadot Namespace]
            SolHook[useSolanaWalletConnect<br/>Solana Namespace]
            BTCHook[useBitcoinWalletConnect<br/>BIP122 Namespace]
        end
        
        subgraph "WalletConnect Clients"
            EVMClient[EVM SignClient]
            SubClient[Substrate SignClient]
            SolClient[Solana SignClient]
            BTCClient[Bitcoin SignClient]
        end
    end
    
    subgraph "Backend Layer"
        API[API Gateway]
        
        subgraph "Namespace Services"
            EVMService[EvmWalletConnectService]
            SubService[SubstrateWalletConnectService]
            SolService[SolanaWalletConnectService]
            BTCService[BitcoinWalletConnectService]
        end
        
        subgraph "Core Services"
            AddrMgr[AddressManager]
            SeedMgr[SeedManager]
            AccFactory[AccountFactory]
        end
    end
    
    subgraph "External Services"
        WCRelay[WalletConnect Relay<br/>Bridge Server]
        DApp1[EVM DApp<br/>Uniswap]
        DApp2[Substrate DApp<br/>Hydration]
        DApp3[Multi-Chain DApp]
    end
    
    UI --> MCH
    MCH --> EVMHook
    MCH --> SubHook
    MCH --> SolHook
    MCH --> BTCHook
    
    EVMHook --> EVMClient
    SubHook --> SubClient
    SolHook --> SolClient
    BTCHook --> BTCClient
    
    EVMHook --> API
    SubHook --> API
    SolHook --> API
    BTCHook --> API
    
    API --> EVMService
    API --> SubService
    API --> SolService
    API --> BTCService
    
    EVMService --> AddrMgr
    EVMService --> SeedMgr
    EVMService --> AccFactory
    
    SubService --> AddrMgr
    SubService --> SeedMgr
    SubService --> AccFactory
    
    EVMClient <--> WCRelay
    SubClient <--> WCRelay
    SolClient <--> WCRelay
    BTCClient <--> WCRelay
    
    WCRelay <--> DApp1
    WCRelay <--> DApp2
    WCRelay <--> DApp3
    
    style EVMHook fill:#3b82f6
    style SubHook fill:#10b981
    style SolHook fill:#f59e0b
    style BTCHook fill:#ef4444
    
    style EVMClient fill:#3b82f6
    style SubClient fill:#10b981
    style SolClient fill:#f59e0b
    style BTCClient fill:#ef4444
    
    style EVMService fill:#3b82f6
    style SubService fill:#10b981
    style SolService fill:#f59e0b
    style BTCService fill:#ef4444
`;

// ============================================================================
// DIAGRAM 2: Connection Flow (Session Establishment)
// ============================================================================

const connectionFlow = `
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#1e3a8a','primaryTextColor':'#fff'}}}%%

sequenceDiagram
    participant DApp as DApp<br/>(Uniswap)
    participant Relay as WalletConnect<br/>Relay
    participant Frontend as Frontend<br/>(useEvmWalletConnect)
    participant Backend as Backend<br/>(EvmWalletConnectService)
    participant Wallet as Wallet Storage<br/>(Seed/Keys)
    
    Note over DApp,Wallet: Phase 1: URI Generation & Pairing
    
    DApp->>DApp: User clicks "Connect Wallet"
    DApp->>Relay: Create session proposal
    Relay-->>DApp: Return WalletConnect URI
    DApp->>DApp: Display URI & QR Code
    
    Note over Frontend: User copies URI
    
    Frontend->>Frontend: User pastes URI
    Frontend->>Frontend: Validate URI format (wc:...)
    Frontend->>Relay: Pair with URI
    
    Note over DApp,Wallet: Phase 2: Session Proposal
    
    Relay->>Frontend: session_proposal event
    Frontend->>Frontend: Parse required namespaces
    
    alt EIP155 Namespace Detected
        Frontend->>Backend: GET /wallet/evm/walletconnect/accounts
        Backend->>Wallet: Get EVM addresses
        Wallet-->>Backend: Return addresses
        Backend-->>Frontend: CAIP-10 accounts<br/>(eip155:1:0x...)
        
        Frontend->>Frontend: Show approval dialog<br/>(DApp name, URL, chains)
        
        alt User Approves
            Frontend->>Relay: Approve session with namespaces
            Relay->>DApp: Session established
            DApp-->>DApp: Update UI (Connected)
            Relay-->>Frontend: Session approved
            Frontend->>Frontend: Store session & update UI
        else User Rejects
            Frontend->>Relay: Reject session
            Relay->>DApp: Session rejected
        end
        
    else Polkadot Namespace Detected
        Note over Frontend,Backend: Route to Substrate handler
        Frontend->>Backend: GET /wallet/substrate/walletconnect/accounts
        Backend-->>Frontend: CAIP-10 accounts<br/>(polkadot:hash:address)
    end
    
    Note over DApp,Wallet: Phase 3: Connection Complete
    
    Frontend->>Frontend: Display session card<br/>(DApp info, accounts)
`;

// ============================================================================
// DIAGRAM 3: Transaction Signing Flow (EVM)
// ============================================================================

const transactionSigningFlow = `
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#1e3a8a','primaryTextColor':'#fff'}}}%%

sequenceDiagram
    participant DApp as DApp<br/>(Uniswap)
    participant Relay as WalletConnect<br/>Relay
    participant Frontend as Frontend<br/>(useEvmWalletConnect)
    participant Backend as Backend<br/>(EvmWalletConnectService)
    participant Wallet as Wallet Storage<br/>(Seed/Keys)
    
    Note over DApp,Wallet: User initiates transaction in DApp
    
    DApp->>Relay: session_request<br/>(eth_sendTransaction)
    Relay->>Frontend: Request received
    
    Frontend->>Frontend: Parse request parameters<br/>(accountId, tx details)
    
    Frontend->>Frontend: Show confirmation dialog<br/>┌─────────────────┐<br/>│ Sign Transaction│<br/>│ To: 0xabcd...   │<br/>│ Value: 1.5 ETH  │<br/>│ Gas: 21000      │<br/>│ [Cancel][Sign]  │<br/>└─────────────────┘
    
    alt User Approves
        Frontend->>Backend: POST /wallet/evm/walletconnect/sign-transaction<br/>{ accountId, transaction }
        
        Backend->>Backend: Parse CAIP-10 accountId<br/>(eip155:1:0x1234...)
        Backend->>Backend: Extract chainId & address
        
        Backend->>Backend: Verify account ownership<br/>(address belongs to userId)
        
        alt Account Verified
            Backend->>Wallet: Get seed phrase for userId
            Wallet-->>Backend: Return encrypted seed
            Backend->>Backend: Decrypt seed
            
            Backend->>Backend: Create account instance<br/>(AccountFactory or PimlicoFactory)
            
            Backend->>Backend: Build transaction object<br/>(EIP-1559 or Legacy)
            
            Backend->>Backend: Sign transaction with private key
            
            Backend->>Backend: Clear seed from memory
            
            Backend-->>Frontend: { signature, txHash }
            
            Frontend->>Relay: Respond with signature
            Relay->>DApp: Transaction signed
            
            DApp->>DApp: Broadcast transaction to network
            DApp-->>DApp: Show tx confirmation
            
            Frontend->>Frontend: Show success notification<br/>"✅ Transaction signed"
            
        else Account Not Owned
            Backend-->>Frontend: Error: Unauthorized
            Frontend->>Relay: Error response
            Frontend->>Frontend: Show error dialog
        end
        
    else User Rejects
        Frontend->>Relay: Error response<br/>(User rejected)
        Relay->>DApp: Request rejected
        Frontend->>Frontend: Show "Transaction cancelled"
    end
`;

// ============================================================================
// DIAGRAM 4: Message Signing Flow (personal_sign)
// ============================================================================

const messageSigningFlow = `
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#1e3a8a','primaryTextColor':'#fff'}}}%%

sequenceDiagram
    participant DApp as DApp
    participant Relay as WalletConnect<br/>Relay
    participant Frontend as Frontend<br/>(useEvmWalletConnect)
    participant Backend as Backend<br/>(EvmWalletConnectService)
    participant Wallet as Wallet Storage
    
    Note over DApp,Wallet: DApp requests message signature (Login, etc.)
    
    DApp->>Relay: session_request<br/>(personal_sign or eth_sign)
    Relay->>Frontend: Request received
    
    Frontend->>Frontend: Parse request<br/>{ method, params: [message, address] }
    
    Frontend->>Frontend: Show confirmation dialog<br/>┌──────────────────────┐<br/>│ Sign Message         │<br/>│ Account: 0x1234...   │<br/>│ Message:             │<br/>│ "Login to DApp"      │<br/>│ [Cancel][Sign]       │<br/>└──────────────────────┘
    
    alt User Approves
        Frontend->>Backend: POST /wallet/evm/walletconnect/sign-message<br/>{ accountId, message }
        
        Backend->>Backend: Parse CAIP-10 accountId
        Backend->>Backend: Verify account ownership
        
        Backend->>Wallet: Get seed phrase
        Backend->>Backend: Create signer instance
        Backend->>Backend: Sign message<br/>(ECDSA signature)
        Backend->>Backend: Clear seed from memory
        
        Backend-->>Frontend: { signature: "0x..." }
        
        Frontend->>Relay: Respond with signature
        Relay->>DApp: Message signed
        
        DApp->>DApp: Verify signature on-chain/off-chain
        DApp-->>DApp: Grant access (login success)
        
    else User Rejects
        Frontend->>Relay: Error: User rejected
        Relay->>DApp: Request rejected
    end
`;

// ============================================================================
// DIAGRAM 5: Multi-Namespace Session Management
// ============================================================================

const multiNamespaceFlow = `
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#1e3a8a','primaryTextColor':'#fff'}}}%%

graph TB
    subgraph "User's Wallet State"
        Sessions[Active Sessions]
        EVMSessions[EVM Sessions<br/>Topic: abc123<br/>DApp: Uniswap<br/>Chains: 1, 8453]
        SubSessions[Substrate Sessions<br/>Topic: def456<br/>DApp: Hydration<br/>Chains: polkadot]
        SolSessions[Solana Sessions<br/>Topic: ghi789<br/>DApp: Jupiter<br/>Chains: solana-mainnet]
    end
    
    subgraph "WalletConnect Clients"
        EVMClient[EVM SignClient<br/>Namespace: eip155]
        SubClient[Substrate SignClient<br/>Namespace: polkadot]
        SolClient[Solana SignClient<br/>Namespace: solana]
    end
    
    subgraph "Session Operations"
        Connect[Connect New DApp]
        Sign[Sign Transaction/Message]
        Disconnect[Disconnect Session]
        DisconnectAll[Disconnect All]
    end
    
    subgraph "Namespace Detection"
        URIParse[Parse WalletConnect URI]
        ProposalParse[Parse Session Proposal]
        NamespaceRoute[Route to Correct Client]
    end
    
    Sessions --> EVMSessions
    Sessions --> SubSessions
    Sessions --> SolSessions
    
    EVMSessions --> EVMClient
    SubSessions --> SubClient
    SolSessions --> SolClient
    
    Connect --> URIParse
    URIParse --> ProposalParse
    ProposalParse --> NamespaceRoute
    
    NamespaceRoute -.->|eip155| EVMClient
    NamespaceRoute -.->|polkadot| SubClient
    NamespaceRoute -.->|solana| SolClient
    
    Sign --> |Find by topic| EVMClient
    Sign --> |Find by topic| SubClient
    Sign --> |Find by topic| SolClient
    
    Disconnect --> |Topic-based| EVMClient
    Disconnect --> |Topic-based| SubClient
    Disconnect --> |Topic-based| SolClient
    
    DisconnectAll --> EVMClient
    DisconnectAll --> SubClient
    DisconnectAll --> SolClient
    
    style EVMSessions fill:#3b82f6
    style SubSessions fill:#10b981
    style SolSessions fill:#f59e0b
    
    style EVMClient fill:#3b82f6
    style SubClient fill:#10b981
    style SolClient fill:#f59e0b
`;

// ============================================================================
// DIAGRAM 6: Error Handling & Isolation
// ============================================================================

const errorHandlingFlow = `
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#1e3a8a','primaryTextColor':'#fff'}}}%%

graph TD
    Request[Incoming Request]
    
    subgraph "Error Isolation Layer"
        Try[Try Operation]
        Catch[Catch Error]
        LogError[Log Error]
        ReturnError[Return User-Friendly Error]
    end
    
    subgraph "Namespace-Specific Errors"
        EVMError[EVM Error<br/>Does not affect Substrate]
        SubError[Substrate Error<br/>Does not affect EVM]
        SolError[Solana Error<br/>Does not affect others]
    end
    
    subgraph "Recovery Strategies"
        Retry[Retry with Backoff]
        Fallback[Use Fallback Provider]
        SkipNamespace[Skip Failed Namespace]
        NotifyUser[Notify User]
    end
    
    Request --> Try
    
    Try --> |Success| Success[Continue]
    Try --> |Error| Catch
    
    Catch --> LogError
    LogError --> EVMError
    LogError --> SubError
    LogError --> SolError
    
    EVMError --> SkipNamespace
    SubError --> SkipNamespace
    SolError --> SkipNamespace
    
    SkipNamespace --> |Other namespaces work| Success
    
    EVMError --> Retry
    Retry --> |Still fails| NotifyUser
    Retry --> |Success| Success
    
    NotifyUser --> ReturnError
    ReturnError --> |Show to user| UI[User Interface]
    
    style EVMError fill:#ef4444
    style SubError fill:#ef4444
    style SolError fill:#ef4444
    style Success fill:#10b981
`;

// ============================================================================
// DIAGRAM 7: CAIP-10 Format Structure
// ============================================================================

const caip10Structure = `
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#1e3a8a','primaryTextColor':'#fff'}}}%%

graph TB
    CAIP10[CAIP-10 Account ID Format]
    
    subgraph "Structure"
        Format["namespace : reference : address"]
        Example1["eip155 : 1 : 0x1234...5678"]
        Example2["polkadot : 91b171bb158e2d3... : 5GrwvaEF5z..."]
        Example3["solana : mainnet : 7xKXtg2CW87d97..."]
    end
    
    subgraph "EVM (EIP155)"
        EVMNamespace[Namespace: eip155]
        EVMReference[Reference: Chain ID<br/>1 = Ethereum<br/>8453 = Base<br/>42161 = Arbitrum]
        EVMAddress[Address: 0x prefixed<br/>Ethereum address]
        EVMExample[eip155:1:0x1234...5678]
    end
    
    subgraph "Substrate (Polkadot)"
        SubNamespace[Namespace: polkadot]
        SubReference[Reference: Genesis Hash<br/>First 32 chars without 0x]
        SubAddress[Address: SS58 encoded<br/>Based on chain prefix]
        SubExample[polkadot:91b171bb...:5GrwvaEF...]
    end
    
    subgraph "Solana"
        SolNamespace[Namespace: solana]
        SolReference[Reference: Cluster<br/>mainnet, testnet, devnet]
        SolAddress[Address: Base58 public key]
        SolExample[solana:mainnet:7xKXtg2...]
    end
    
    subgraph "Bitcoin (BIP122)"
        BTCNamespace[Namespace: bip122]
        BTCReference[Reference: Genesis Hash<br/>First 32 chars]
        BTCAddress[Address: Bitcoin address<br/>Base58 or Bech32]
        BTCExample[bip122:000000000019...:1A1zP1eP...]
    end
    
    CAIP10 --> Format
    Format --> Example1
    Format --> Example2
    Format --> Example3
    
    Example1 -.-> EVMNamespace
    EVMNamespace --> EVMReference
    EVMReference --> EVMAddress
    EVMAddress --> EVMExample
    
    Example2 -.-> SubNamespace
    SubNamespace --> SubReference
    SubReference --> SubAddress
    SubAddress --> SubExample
    
    style EVMExample fill:#3b82f6
    style SubExample fill:#10b981
    style SolExample fill:#f59e0b
    style BTCExample fill:#ef4444
`;

// ============================================================================
// DIAGRAM 8: Frontend Component Hierarchy
// ============================================================================

const componentHierarchy = `
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#1e3a8a','primaryTextColor':'#fff'}}}%%

graph TD
    App[App Root]
    
    subgraph "Dashboard"
        Dashboard[Dashboard Page]
        Tabs[Tab Navigation<br/>EVM | Substrate | Solana]
    end
    
    subgraph "Multi-Chain Component"
        MultiChain[MultiChainWalletConnect]
        AllSessions[All Sessions View]
        UnifiedURI[Unified URI Input]
    end
    
    subgraph "EVM Components"
        EVMTab[EVM Tab]
        EVMConnect[EvmWalletConnect]
        EVMSessions[EVM Session List]
        EVMSessionCard[EVM Session Card]
    end
    
    subgraph "Substrate Components"
        SubTab[Substrate Tab]
        SubConnect[SubstrateWalletConnect]
        SubSessions[Substrate Session List]
        SubSessionCard[Substrate Session Card]
    end
    
    subgraph "Shared Components"
        URIInput[URI Input Field]
        ConnectBtn[Connect Button]
        SessionCard[Session Card Base]
        DisconnectBtn[Disconnect Button]
        ConfirmDialog[Confirmation Dialog]
    end
    
    subgraph "Hooks Layer"
        MultiHook[useMultiChainWalletConnect]
        EVMHook[useEvmWalletConnect]
        SubHook[useSubstrateWalletConnect]
    end
    
    App --> Dashboard
    Dashboard --> Tabs
    
    Tabs --> MultiChain
    MultiChain --> AllSessions
    MultiChain --> UnifiedURI
    
    Tabs --> EVMTab
    EVMTab --> EVMConnect
    EVMConnect --> EVMSessions
    EVMSessions --> EVMSessionCard
    
    Tabs --> SubTab
    SubTab --> SubConnect
    SubConnect --> SubSessions
    SubSessions --> SubSessionCard
    
    EVMConnect --> URIInput
    EVMConnect --> ConnectBtn
    EVMSessionCard --> SessionCard
    EVMSessionCard --> DisconnectBtn
    
    SubConnect --> URIInput
    SubConnect --> ConnectBtn
    SubSessionCard --> SessionCard
    SubSessionCard --> DisconnectBtn
    
    EVMConnect --> EVMHook
    SubConnect --> SubHook
    MultiChain --> MultiHook
    
    MultiHook --> EVMHook
    MultiHook --> SubHook
    
    EVMHook --> ConfirmDialog
    SubHook --> ConfirmDialog
    
    style MultiChain fill:#8b5cf6
    style EVMTab fill:#3b82f6
    style SubTab fill:#10b981
`;

// ============================================================================
// DIAGRAM 9: Backend Service Architecture
// ============================================================================

const backendArchitecture = `
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#1e3a8a','primaryTextColor':'#fff'}}}%%

graph TB
    subgraph "API Layer"
        Gateway[API Gateway]
        Auth[Authentication Middleware]
        Validation[Request Validation]
    end
    
    subgraph "Controllers"
        EVMCtrl[EvmWalletConnectController<br/>/wallet/evm/walletconnect/*]
        SubCtrl[SubstrateWalletConnectController<br/>/wallet/substrate/walletconnect/*]
        SolCtrl[SolanaWalletConnectController<br/>/wallet/solana/walletconnect/*]
    end
    
    subgraph "Services"
        EVMSvc[EvmWalletConnectService<br/>- formatAccountId()<br/>- parseAccountId()<br/>- signTransaction()<br/>- signMessage()<br/>- signTypedData()]
        
        SubSvc[SubstrateWalletConnectService<br/>- formatAccountId()<br/>- parseAccountId()<br/>- signTransaction()<br/>- signMessage()<br/>- getFormattedAccounts()]
        
        SolSvc[SolanaWalletConnectService<br/>- formatAccountId()<br/>- parseAccountId()<br/>- signTransaction()<br/>- signMessage()]
    end
    
    subgraph "Shared Services"
        SeedMgr[SeedManager<br/>- getSeed()<br/>- createSeed()<br/>- importSeed()]
        
        AddrMgr[AddressManager<br/>- getAddress()<br/>- getManagedAddresses()<br/>- deriveAddresses()]
        
        AccFactory[AccountFactory<br/>- createAccount()<br/>- getAccount()]
        
        PimlicoFactory[PimlicoAccountFactory<br/>- createAccount()<br/>- getSmartAccount()]
    end
    
    subgraph "Storage"
        DB[(Database<br/>Prisma)]
        Encryption[Encryption Service]
    end
    
    Gateway --> Auth
    Auth --> Validation
    Validation --> EVMCtrl
    Validation --> SubCtrl
    Validation --> SolCtrl
    
    EVMCtrl --> EVMSvc
    SubCtrl --> SubSvc
    SolCtrl --> SolSvc
    
    EVMSvc --> SeedMgr
    EVMSvc --> AddrMgr
    EVMSvc --> AccFactory
    EVMSvc --> PimlicoFactory
    
    SubSvc --> SeedMgr
    SubSvc --> AddrMgr
    SubSvc --> AccFactory
    
    SolSvc --> SeedMgr
    SolSvc --> AddrMgr
    SolSvc --> AccFactory
    
    SeedMgr --> DB
    SeedMgr --> Encryption
    AddrMgr --> DB
    
    style EVMCtrl fill:#3b82f6
    style SubCtrl fill:#10b981
    style SolCtrl fill:#f59e0b
    
    style EVMSvc fill:#3b82f6
    style SubSvc fill:#10b981
    style SolSvc fill:#f59e0b
`;

// ============================================================================
// DIAGRAM 10: Implementation Phases Timeline
// ============================================================================

const implementationPhases = `
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#1e3a8a','primaryTextColor':'#fff'}}}%%

gantt
    title WalletConnect Multi-Chain Implementation Timeline
    dateFormat  YYYY-MM-DD
    section Phase 1: Foundation
    Base Interfaces & Types           :done, p1a, 2025-10-01, 5d
    Substrate Implementation          :done, p1b, 2025-10-06, 10d
    Testing & Documentation           :done, p1c, 2025-10-16, 5d
    
    section Phase 2: EVM Implementation
    Backend EVM Service               :active, p2a, 2025-11-19, 7d
    Backend EVM Controller            :p2b, after p2a, 5d
    Frontend EVM Hook                 :p2c, after p2b, 7d
    Frontend EVM UI                   :p2d, after p2c, 5d
    EVM Testing                       :p2e, after p2d, 5d
    
    section Phase 3: Multi-Chain
    Unified Hook Development          :p3a, after p2e, 7d
    Unified UI Components             :p3b, after p3a, 5d
    Integration Testing               :p3c, after p3b, 5d
    Documentation                     :p3d, after p3c, 3d
    
    section Phase 4: Future Chains
    Solana Implementation             :crit, p4a, after p3d, 14d
    Bitcoin Implementation            :crit, p4b, after p4a, 14d
    Other Chains                      :p4c, after p4b, 21d
`;

// ============================================================================
// Export all diagrams
// ============================================================================

export const diagrams = {
  architectureOverview,
  connectionFlow,
  transactionSigningFlow,
  messageSigningFlow,
  multiNamespaceFlow,
  errorHandlingFlow,
  caip10Structure,
  componentHierarchy,
  backendArchitecture,
  implementationPhases,
};

// ============================================================================
// Usage Instructions
// ============================================================================

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║  WalletConnect Multi-Chain Architecture - Visual Diagrams         ║
╚════════════════════════════════════════════════════════════════════╝

📊 This file contains 10 comprehensive diagrams:

1. Architecture Overview - High-level system architecture
2. Connection Flow - Session establishment sequence
3. Transaction Signing Flow - EVM transaction signing
4. Message Signing Flow - Message signature process
5. Multi-Namespace Management - Session management across chains
6. Error Handling & Isolation - Error propagation and recovery
7. CAIP-10 Format Structure - Account ID format specification
8. Component Hierarchy - Frontend component tree
9. Backend Architecture - Service layer structure
10. Implementation Timeline - Gantt chart of development phases

🔧 How to Use:

Option 1: Mermaid Live Editor (Recommended)
1. Visit https://mermaid.live/
2. Copy any diagram code from this file
3. Paste into the editor
4. View the interactive diagram

Option 2: VS Code Mermaid Extension
1. Install "Markdown Preview Mermaid Support" extension
2. Create a .md file with the diagram code in a code block:
   \`\`\`mermaid
   [paste diagram code here]
   \`\`\`
3. Preview the markdown file

Option 3: GitHub/GitLab
- Commit this file and diagrams will render automatically in .md files

Option 4: Documentation Sites
- Integrate with Docusaurus, VuePress, or MkDocs with Mermaid plugins

📝 Diagram Exports Available:

You can programmatically access diagrams using:

import { diagrams } from './walletconnect-diagram.js';

const code = diagrams.architectureOverview;
const txFlow = diagrams.transactionSigningFlow;
// ... etc.

🎨 Color Scheme:

- EVM/EIP155:   Blue (#3b82f6)
- Substrate:    Green (#10b981)
- Solana:       Orange (#f59e0b)
- Bitcoin:      Red (#ef4444)
- Multi-Chain:  Purple (#8b5cf6)

💡 Tips:

- All diagrams use the same color scheme for consistency
- Mermaid.live allows exporting to PNG, SVG, and PDF
- Diagrams are kept modular for easy updates
- Each diagram focuses on a specific aspect of the system

📚 References:

- Mermaid Docs: https://mermaid.js.org/
- WalletConnect Docs: https://docs.reown.com/
- CAIP Standards: https://github.com/ChainAgnostic/CAIPs

Happy Diagramming! 🚀
`);

// ============================================================================
// Quick Access Functions
// ============================================================================

/**
 * Get a specific diagram by name
 * @param {string} name - Name of the diagram
 * @returns {string} The diagram code
 */
export function getDiagram(name) {
  return diagrams[name];
}

/**
 * Get all diagram names
 * @returns {string[]} Array of diagram names
 */
export function getDiagramNames() {
  return Object.keys(diagrams);
}

/**
 * Generate a markdown file with all diagrams
 * @returns {string} Markdown content with all diagrams
 */
export function generateMarkdown() {
  let markdown = `# WalletConnect Multi-Chain Architecture - Visual Diagrams\n\n`;
  markdown += `> **Note**: This document contains Mermaid.js diagrams. View on GitHub or use a Mermaid-compatible viewer.\n\n`;
  
  const titles = [
    'Architecture Overview',
    'Connection Flow (Session Establishment)',
    'Transaction Signing Flow (EVM)',
    'Message Signing Flow (personal_sign)',
    'Multi-Namespace Session Management',
    'Error Handling & Isolation',
    'CAIP-10 Account ID Format Structure',
    'Frontend Component Hierarchy',
    'Backend Service Architecture',
    'Implementation Phases Timeline',
  ];
  
  Object.entries(diagrams).forEach(([key, value], index) => {
    markdown += `## ${index + 1}. ${titles[index]}\n\n`;
    markdown += `\`\`\`mermaid\n${value}\n\`\`\`\n\n`;
    markdown += `---\n\n`;
  });
  
  return markdown;
}

/**
 * Example: Generate the markdown document
 */
if (require.main === module) {
  const fs = require('fs');
  const markdown = generateMarkdown();
  fs.writeFileSync('WalletConnectDiagrams.md', markdown);
  console.log('✅ Generated WalletConnectDiagrams.md');
}
