import { useState, useEffect } from 'react';
import { 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  Database, 
  Code, 
  BookOpen, 
  Cpu, 
  Star, 
  Globe, 
  Sliders, 
  AlertCircle 
} from 'lucide-react';
import mcpServersJson from './data/mcp_servers_data.json';

// Types
interface EnvVar {
  name: string;
  description: string;
  required: boolean;
  placeholder: string;
}

interface McpServer {
  name: string;
  full_name: string;
  html_url: string;
  stars: number;
  description: string;
  category: string;
  target_user_segment?: string;
  language: string;
  installCommand: string;
  args: string[];
  envVars: EnvVar[];
  tools: string[];
  resources: string[];
}

// Fallback seed data in case JSON is empty or still loading
const SEED_SERVERS: McpServer[] = [
  {
    name: "PostgreSQL Database Connector",
    full_name: "modelcontextprotocol/server-postgres",
    html_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
    stars: 240,
    description: "Enables secure, read-only or read-write access to PostgreSQL databases, allowing agents to inspect schemas, execute queries, and describe tables.",
    category: "Databases",
    target_user_segment: "analyst",
    language: "TypeScript",
    installCommand: "npx -y @modelcontextprotocol/server-postgres",
    args: ["<POSTGRES_URL>"],
    envVars: [
      {
        name: "POSTGRES_URL",
        description: "PostgreSQL connection string. e.g. postgresql://username:password@localhost:5432/mydb",
        required: true,
        placeholder: "postgresql://localhost:5432/mydb"
      }
    ],
    tools: ["query (Run SQL statements)", "describe_table (Get column details)"],
    resources: ["postgres://schema (List database tables)"]
  },
  {
    name: "GitHub Repository Manager",
    full_name: "modelcontextprotocol/server-github",
    html_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
    stars: 580,
    description: "Allows AI agents to search, view, commit, and manage files on GitHub, alongside reading pull requests, issues, and running repository searches.",
    category: "Developer Tools",
    target_user_segment: "developer",
    language: "TypeScript",
    installCommand: "npx -y @modelcontextprotocol/server-github",
    args: [],
    envVars: [
      {
        name: "GITHUB_PERSONAL_ACCESS_TOKEN",
        description: "GitHub PAT with repo scopes",
        required: true,
        placeholder: "ghp_yourTokenHere"
      }
    ],
    tools: ["search_repositories", "create_issue", "get_file_contents", "create_or_update_file"],
    resources: []
  },
  {
    name: "Brave Search Integrator",
    full_name: "modelcontextprotocol/server-brave-search",
    html_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
    stars: 310,
    description: "Equips agents with global web search and local location-based search capabilities using the Brave Search API, extending agent knowledge dynamically.",
    category: "Web & Browsing",
    target_user_segment: "creator",
    language: "TypeScript",
    installCommand: "npx -y @modelcontextprotocol/server-brave-search",
    args: [],
    envVars: [
      {
        name: "BRAVE_API_KEY",
        description: "Brave Search API Subscription Key",
        required: true,
        placeholder: "BSA_yourApiKeyHere"
      }
    ],
    tools: ["brave_web_search", "brave_local_search"],
    resources: []
  },
  {
    name: "Sqlite Local Database",
    full_name: "modelcontextprotocol/server-sqlite",
    html_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
    stars: 190,
    description: "Provides agents with capabilities to spin up, query, and populate local SQLite database files, making persistent structured memory simple.",
    category: "Databases",
    target_user_segment: "analyst",
    language: "TypeScript",
    installCommand: "npx -y @modelcontextprotocol/server-sqlite",
    args: ["<DB_PATH>"],
    envVars: [
      {
        name: "DB_PATH",
        description: "Absolute path to local sqlite file",
        required: true,
        placeholder: "/Users/user/dev/database.db"
      }
    ],
    tools: ["execute_sql", "list_tables", "get_table_schema"],
    resources: []
  },
  {
    name: "Playwright Web Browser",
    full_name: "modelcontextprotocol/server-playwright",
    html_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/playwright",
    stars: 420,
    description: "Launches a headless browser instance using Playwright, letting AI agents click, input text, scrape content, and capture screenshots of websites.",
    category: "Web & Browsing",
    target_user_segment: "creator",
    language: "TypeScript",
    installCommand: "npx -y @modelcontextprotocol/server-playwright",
    args: [],
    envVars: [],
    tools: ["navigate", "click", "fill_input", "screenshot", "get_html"],
    resources: []
  },
  {
    name: "Slack Assistant Link",
    full_name: "modelcontextprotocol/server-slack",
    html_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
    stars: 150,
    description: "Connects agents to Slack workspaces. Read history, monitor channels, reply to threads, and publish rich markdown alerts to channels.",
    category: "Productivity & Communication",
    target_user_segment: "creator",
    language: "TypeScript",
    installCommand: "npx -y @modelcontextprotocol/server-slack",
    args: [],
    envVars: [
      {
        name: "SLACK_BOT_TOKEN",
        description: "Slack Bot User OAuth Token",
        required: true,
        placeholder: "xoxb-your-token"
      }
    ],
    tools: ["post_message", "get_channels", "read_history", "add_reaction"],
    resources: []
  }
];

export default function App() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedSegment, setSelectedSegment] = useState('All');
  
  // Modal state
  const [selectedServer, setSelectedServer] = useState<McpServer | null>(null);
  const [clientType, setClientType] = useState<'cursor' | 'claude' | 'windsurf'>('cursor');
  const [envInputs, setEnvInputs] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      let data = [];
      try {
        const s3Path = import.meta.env.VITE_S3_DB_URL || '/src/data/mcp_servers_data.json';
        const res = await fetch(s3Path);
        if (res.ok) {
          data = await res.json();
          console.log("Dynamically loaded database successfully.");
        } else {
          data = mcpServersJson;
        }
      } catch (e) {
        console.warn("Failed dynamic fetch, using local JSON fallback.", e);
        data = mcpServersJson;
      }
      
      const merged = [...data];
      SEED_SERVERS.forEach(seed => {
        if (!merged.some(s => s.full_name === seed.full_name)) {
          merged.push(seed);
        }
      });
      const sorted = merged.sort((a, b) => (b.stars || 0) - (a.stars || 0));
      setServers(sorted);
    };

    loadData();
  }, []);

  // Sync environment variables inputs when a server is selected
  useEffect(() => {
    if (selectedServer) {
      const initialInputs: Record<string, string> = {};
      selectedServer.envVars.forEach(v => {
        initialInputs[v.name] = '';
      });
      setEnvInputs(initialInputs);
      setCopied(false);
    }
  }, [selectedServer]);

  // Categories list
  const categories = ['All', 'Databases', 'Developer Tools', 'Web & Browsing', 'Productivity & Communication', 'AI & Knowledge', 'Other'];
  
  // User Segments mapping
  const segments = [
    { label: 'All Roles', value: 'All' },
    { label: 'For Developers', value: 'developer' },
    { label: 'For Analysts', value: 'analyst' },
    { label: 'For Creators', value: 'creator' },
    { label: 'For Investors', value: 'investor' },
    { label: 'For General Productivity', value: 'general' }
  ];

  // Languages list
  const languages = ['All', 'TypeScript', 'Python', 'Go', 'Rust'];

  // Filter logic
  const filteredServers = servers.filter(server => {
    const matchesSearch = 
      server.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      server.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = selectedCategory === 'All' || server.category === selectedCategory;
    const matchesLanguage = selectedLanguage === 'All' || server.language.toLowerCase() === selectedLanguage.toLowerCase();
    
    // Check target segment (default to 'developer' if empty/missing)
    const serverSegment = server.target_user_segment || 'developer';
    const matchesSegment = selectedSegment === 'All' || serverSegment === selectedSegment;
    
    return matchesSearch && matchesCategory && matchesLanguage && matchesSegment;
  });

  // Category Icon Helper
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Databases': return <Database className="category-icon" size={18} />;
      case 'Developer Tools': return <Code className="category-icon" size={18} />;
      case 'Web & Browsing': return <Globe className="category-icon" size={18} />;
      case 'Productivity & Communication': return <Sliders className="category-icon" size={18} />;
      default: return <Cpu className="category-icon" size={18} />;
    }
  };

  // Generate Config JSON
  const getGeneratedConfig = () => {
    if (!selectedServer) return '';

    // Extract command and arguments
    const parts = selectedServer.installCommand.split(' ');
    const command = parts[0];
    const baseArgs = parts.slice(1);

    // Swap argument placeholders (e.g. <POSTGRES_URL>) with entered values
    const finalArgs = [...baseArgs, ...(selectedServer.args || [])].map(arg => {
      const cleaned = arg.replace('<', '').replace('>', '');
      if (envInputs[cleaned]) {
        return envInputs[cleaned];
      }
      return arg;
    });

    // Build environment variables map
    const envMap: Record<string, string> = {};
    selectedServer.envVars.forEach(v => {
      envMap[v.name] = envInputs[v.name] || `<${v.name}>`;
    });

    // Create JSON based on client type
    const serverKey = selectedServer.name.toLowerCase().replace(/ /g, '-');
    const configData = {
      mcpServers: {
        [serverKey]: {
          command: command,
          args: finalArgs,
          ...(Object.keys(envMap).length > 0 ? { env: envMap } : {})
        }
      }
    };

    if (clientType === 'cursor' || clientType === 'windsurf') {
      // Return config block
      return JSON.stringify(configData, null, 2);
    } else {
      // Claude Desktop format (embedded in top-level mcpServers config)
      return JSON.stringify(configData, null, 2);
    }
  };

  const getClientConfigPath = () => {
    switch (clientType) {
      case 'cursor':
        return 'Create or edit `.cursor/mcp.json` in the root of your project workspace.';
      case 'windsurf':
        return 'Paste into `~/.codeium/windsurf/mcp_config.json` (Mac/Linux) or `%USERPROFILE%/.codeium/windsurf/mcp_config.json` (Windows).';
      case 'claude':
        return 'Paste into `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows).';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getGeneratedConfig());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="header-section">
        <h1 className="header-title">⚡ MCP Registry Hub</h1>
        <p className="header-subtitle">
          Discover, configure, and install Model Context Protocol (MCP) servers for Cursor, Claude Desktop, and Windsurf.
        </p>
      </header>

      {/* Filter and Search Bar */}
      <section className="controls-bar">
        <div className="search-wrapper">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            placeholder="Search MCP servers (e.g. postgres, git)..." 
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select 
          className="filter-select"
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
        >
          <option value="All">All Languages</option>
          {languages.slice(1).map(lang => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
      </section>

      {/* User Segment Filters */}
      <section className="category-filters" style={{ marginBottom: '16px' }}>
        {segments.map(seg => (
          <button
            key={seg.value}
            className={`category-chip ${selectedSegment === seg.value ? 'active' : ''}`}
            onClick={() => setSelectedSegment(seg.value)}
            style={{
              borderColor: selectedSegment === seg.value ? 'var(--color-accent)' : 'var(--border-color)',
              boxShadow: selectedSegment === seg.value ? '0 4px 12px rgba(6, 182, 212, 0.15)' : 'none',
              background: selectedSegment === seg.value ? 'var(--color-accent)' : 'rgba(255,255,255,0.03)'
            }}
          >
            {seg.label}
          </button>
        ))}
      </section>

      {/* Category Chips */}
      <section className="category-filters">
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </section>

      {/* Grid of Servers */}
      <main className="server-grid">
        {filteredServers.length > 0 ? (
          filteredServers.map(server => (
            <article 
              key={server.full_name} 
              className="glass-panel server-card"
              onClick={() => setSelectedServer(server)}
            >
              <div className="card-header">
                <div className="card-title-group">
                  <h3 className="card-title">{server.name}</h3>
                  <span className="card-subtitle">{server.full_name}</span>
                </div>
                {server.stars > 0 && (
                  <div className="star-badge">
                    <Star size={14} fill="currentColor" />
                    <span>{server.stars}</span>
                  </div>
                )}
              </div>
              
              <p className="card-description">{server.description}</p>
              
              <div className="card-footer">
                <span className="category-tag" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {getCategoryIcon(server.category)}
                  {server.category}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {server.target_user_segment || 'developer'}
                  </span>
                  <span className={`badge badge-${server.language.toLowerCase() === 'typescript' ? 'ts' : server.language.toLowerCase() === 'python' ? 'py' : server.language.toLowerCase() === 'go' ? 'go' : 'rust'}`}>
                    {server.language}
                  </span>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <h3>No MCP Servers found</h3>
            <p>Try refining your search query or choosing another category.</p>
          </div>
        )}
      </main>

      {/* Config Generator Modal */}
      {selectedServer && (
        <div className="modal-overlay" onClick={() => setSelectedServer(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedServer(null)}>
              Cancel
            </button>
            
            <h2 style={{ marginBottom: '8px' }}>{selectedServer.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Configure environment variables and copy the config block below to enable this server in your AI client.
            </p>

            {/* Ingestion warning / link */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', marginBottom: '24px', border: '1px dashed var(--border-color)' }}>
              <BookOpen size={16} style={{ color: 'var(--color-accent)' }} />
              <span style={{ fontSize: '0.85rem' }}>
                Source: <a href={selectedServer.html_url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>
                  {selectedServer.full_name} <ExternalLink size={10} style={{ display: 'inline' }} />
                </a>
              </span>
            </div>

            {/* Inputs for Env Variables */}
            {selectedServer.envVars.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Environment Variables</h4>
                {selectedServer.envVars.map(v => (
                  <div key={v.name} className="form-group">
                    <label className="form-label">
                      {v.name} {v.required && <span style={{ color: 'var(--color-error)' }}>*</span>}
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                        {v.description}
                      </span>
                    </label>
                    <input 
                      type="text" 
                      placeholder={v.placeholder}
                      className="form-input"
                      value={envInputs[v.name] || ''}
                      onChange={(e) => setEnvInputs({ ...envInputs, [v.name]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Client Tabs */}
            <div className="tabs-header">
              <button 
                className={`tab-btn ${clientType === 'cursor' ? 'active' : ''}`}
                onClick={() => setClientType('cursor')}
              >
                Cursor
              </button>
              <button 
                className={`tab-btn ${clientType === 'claude' ? 'active' : ''}`}
                onClick={() => setClientType('claude')}
              >
                Claude Desktop
              </button>
              <button 
                className={`tab-btn ${clientType === 'windsurf' ? 'active' : ''}`}
                onClick={() => setClientType('windsurf')}
              >
                Windsurf
              </button>
            </div>

            {/* Path description */}
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, color: '#ffffff' }}>Location: </span>
              {getClientConfigPath()}
            </p>

            {/* Config Block Display */}
            <div className="code-block-wrapper">
              <div className="code-block-header">
                <span>JSON CONFIGURATION</span>
                <button className="copy-btn" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check size={14} style={{ color: 'var(--color-success)' }} />
                      <span style={{ color: 'var(--color-success)' }}>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Config</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="code-block">
                {getGeneratedConfig()}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
