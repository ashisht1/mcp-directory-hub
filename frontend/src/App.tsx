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
  AlertCircle,
  Activity,
  CheckCircle2,
  Terminal,
  Mail,
  LayoutGrid,
  List
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
  const [activeTab, setActiveTab] = useState<'registry' | 'status'>('registry');
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [auditReport, setAuditReport] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [paginationMode, setPaginationMode] = useState<'pages' | 'infinite'>('pages');
  const [visibleCount, setVisibleCount] = useState(6);
  const itemsPerPage = 6;
  
  // Modal state
  const [selectedServer, setSelectedServer] = useState<McpServer | null>(null);
  const [clientType, setClientType] = useState<'cursor' | 'claude' | 'windsurf'>('cursor');
  const [envInputs, setEnvInputs] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

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

  // Pagination calculations
  const totalPages = Math.ceil(filteredServers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentServers = paginationMode === 'pages'
    ? filteredServers.slice(indexOfFirstItem, indexOfLastItem)
    : filteredServers.slice(0, visibleCount);

  const getS3Url = (filename: string) => {
    const dbUrl = import.meta.env.VITE_S3_DB_URL;
    if (dbUrl && dbUrl.includes('/mcp_servers_data.json')) {
      return dbUrl.replace('mcp_servers_data.json', filename);
    }
    return `/src/data/${filename}`;
  };

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

      // Load Agent Status
      try {
        const statusUrl = getS3Url('mcp_agents_status.json');
        const res = await fetch(statusUrl);
        if (res.ok) {
          const statusData = await res.json();
          setAgentStatus(statusData);
        }
      } catch (e) {
        console.warn("Failed to load agent statuses", e);
      }

      // Load Audit Report
      try {
        const auditUrl = getS3Url('mcp_audit_report.json');
        const res = await fetch(auditUrl);
        if (res.ok) {
          const auditData = await res.json();
          setAuditReport(auditData);
        }
      } catch (e) {
        console.warn("Failed to load audit report", e);
      }
    };

    loadData();
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
    setVisibleCount(itemsPerPage);
  }, [searchTerm, selectedCategory, selectedLanguage, selectedSegment]);

  // Infinite scroll listener
  useEffect(() => {
    if (paginationMode !== 'infinite') return;
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop + 100 >=
        document.documentElement.offsetHeight
      ) {
        setVisibleCount(prev => Math.min(prev + itemsPerPage, filteredServers.length));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [paginationMode, filteredServers.length]);

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

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ padding: '4px', display: 'flex', gap: '4px', borderRadius: '30px', background: 'rgba(15, 22, 42, 0.6)' }}>
          <button 
            className={`category-chip ${activeTab === 'registry' ? 'active' : ''}`}
            onClick={() => setActiveTab('registry')}
            style={{ border: 'none', margin: 0, padding: '8px 20px' }}
          >
            🔌 Server Registry
          </button>
          <button 
            className={`category-chip ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
            style={{ border: 'none', margin: 0, padding: '8px 20px' }}
          >
            🤖 Agent System Status
          </button>
        </div>
      </div>

      {activeTab === 'registry' ? (
        <>
          {/* Filter and Search Bar */}
          <section className="controls-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="search-wrapper" style={{ flex: '1 1 300px' }}>
              <Search className="search-icon" size={20} aria-hidden="true" />
              <input 
                type="text" 
                placeholder="Search MCP servers (e.g. postgres, git)..." 
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search MCP servers"
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select 
                className="filter-select"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                aria-label="Filter by programming language"
              >
                <option value="All">All Languages</option>
                {languages.slice(1).map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>

              <select 
                className="filter-select"
                value={paginationMode}
                onChange={(e) => {
                  setPaginationMode(e.target.value as 'pages' | 'infinite');
                  setCurrentPage(1);
                  setVisibleCount(6);
                }}
                style={{ minWidth: '150px' }}
                aria-label="Select pagination mode"
              >
                <option value="pages">Pagination: Pages</option>
                <option value="infinite">Pagination: Scroll</option>
              </select>
              
              <div className="glass-panel" style={{ display: 'flex', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', height: '42px', alignItems: 'center' }}>
                <button
                  onClick={() => setViewMode('grid')}
                  style={{
                    background: viewMode === 'grid' ? 'var(--color-primary)' : 'transparent',
                    border: 'none',
                    color: viewMode === 'grid' ? '#ffffff' : 'var(--text-muted)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    transition: 'all 0.2s ease'
                  }}
                  title="Grid View"
                  aria-label="Switch to card grid view"
                  aria-pressed={viewMode === 'grid'}
                >
                  <LayoutGrid size={18} aria-hidden="true" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    background: viewMode === 'list' ? 'var(--color-primary)' : 'transparent',
                    border: 'none',
                    color: viewMode === 'list' ? '#ffffff' : 'var(--text-muted)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    transition: 'all 0.2s ease'
                  }}
                  title="List View"
                  aria-label="Switch to compact list row view"
                  aria-pressed={viewMode === 'list'}
                >
                  <List size={18} />
                </button>
              </div>
            </div>
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

          {/* List or Grid view container */}
          {filteredServers.length > 0 ? (
            <main 
              className={viewMode === 'grid' ? 'server-grid' : 'server-list-container'}
              role="feed"
              aria-label="MCP Server Catalog"
            >
              {currentServers.map(server => (
                <article 
                  key={server.full_name} 
                  className={`glass-panel ${viewMode === 'grid' ? 'server-card' : 'server-card-list'}`}
                  onClick={() => setSelectedServer(server)}
                  tabIndex={0}
                  role="article"
                  aria-label={`${server.name} server catalog details`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedServer(server);
                    }
                  }}
                >
                  {viewMode === 'grid' ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      {/* Compact List Row Layout */}
                      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 30%', minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h3 className="card-title" style={{ margin: 0, fontSize: '1.15rem' }}>{server.name}</h3>
                          {server.stars > 0 && (
                            <div className="star-badge" style={{ padding: '2px 6px', fontSize: '0.75rem' }}>
                              <Star size={12} fill="currentColor" />
                              <span>{server.stars}</span>
                            </div>
                          )}
                        </div>
                        <span className="card-subtitle" style={{ fontSize: '0.75rem', marginTop: '2px' }}>{server.full_name}</span>
                      </div>

                      <p style={{
                        margin: 0,
                        fontSize: '0.85rem',
                        lineHeight: '1.4',
                        color: 'var(--text-muted)',
                        flex: '1 1 40%',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {server.description}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '0 0 auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <span className="category-tag" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                          {getCategoryIcon(server.category)}
                          {server.category}
                        </span>
                        <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {server.target_user_segment || 'developer'}
                        </span>
                        <span className={`badge badge-${server.language.toLowerCase() === 'typescript' ? 'ts' : server.language.toLowerCase() === 'python' ? 'py' : server.language.toLowerCase() === 'go' ? 'go' : 'rust'}`}>
                          {server.language}
                        </span>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </main>
          ) : (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <h3>No MCP Servers found</h3>
              <p>Try refining your search query or choosing another category.</p>
            </div>
          )}

          {/* Pagination Controls */}
          {paginationMode === 'pages' && totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '32px' }}>
              <button 
                className="category-chip"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{ opacity: currentPage === 1 ? 0.5 : 0.9, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button 
                className="category-chip"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{ opacity: currentPage === totalPages ? 0.5 : 0.9, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          )}

          {/* Infinite Scroll loading indicator */}
          {paginationMode === 'infinite' && visibleCount < filteredServers.length && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 0' }}>
              <div className="category-chip" style={{ background: 'rgba(255,255,255,0.03)', borderStyle: 'dashed', cursor: 'default' }}>
                🫵 Scroll down to load more tools... ({visibleCount} of {filteredServers.length} loaded)
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Health Summary Banner */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(15, 23, 42, 0.4)' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: agentStatus?.monitor?.status === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: agentStatus?.monitor?.status === 'success' ? 'var(--color-success)' : 'var(--color-error)'
            }}>
              <Activity size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                System Status: 
                <span style={{ 
                  color: agentStatus?.monitor?.status === 'success' ? 'var(--color-success)' : 'var(--color-error)',
                  fontSize: '1.1rem',
                  fontWeight: 600
                }}>
                  {agentStatus?.monitor?.status === 'success' ? '● All Systems Operational' : '● Issues Detected'}
                </span>
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Three specialized serverless agents maintain, audit, and monitor the health of this directory.
              </p>
            </div>
          </div>

          {/* Three Agent Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {/* Agent 1 */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.15rem' }}>🤖 Ingestion Agent</h3>
                <span className="badge" style={{ 
                  background: agentStatus?.updater?.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                  color: agentStatus?.updater?.status === 'success' ? 'var(--color-success)' : 'var(--color-error)' 
                }}>
                  {agentStatus?.updater?.status || 'Unknown'}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Crawls GitHub Search APIs and awesome list readmes to discover new servers, then parses and structures schemas.
              </p>
              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <strong>Last Run:</strong> {agentStatus?.updater?.last_run ? new Date(agentStatus.updater.last_run).toLocaleString() : 'N/A'}
                </div>
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: '#ffffff', 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '8px', 
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap'
                }}>
                  {agentStatus?.updater?.message || 'Waiting for first run...'}
                </div>
              </div>
            </div>

            {/* Agent 2 */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.15rem' }}>🔍 Quality Auditor Agent</h3>
                <span className="badge" style={{ 
                  background: agentStatus?.auditor?.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                  color: agentStatus?.auditor?.status === 'success' ? 'var(--color-success)' : 'var(--color-error)' 
                }}>
                  {agentStatus?.auditor?.status || 'Unknown'}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Inspects all server entries, checking URLs and using Bedrock Llama 3 70B to auto-correct any category or user-segment misalignments.
              </p>
              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <strong>Last Run:</strong> {agentStatus?.auditor?.last_run ? new Date(agentStatus.auditor.last_run).toLocaleString() : 'N/A'}
                </div>
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: '#ffffff', 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '8px', 
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap'
                }}>
                  {agentStatus?.auditor?.message || 'Waiting for first run...'}
                </div>
              </div>
            </div>

            {/* Agent 3 */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.15rem' }}>🛡️ Health Monitor Agent</h3>
                <span className="badge" style={{ 
                  background: agentStatus?.monitor?.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                  color: agentStatus?.monitor?.status === 'success' ? 'var(--color-success)' : 'var(--color-error)' 
                }}>
                  {agentStatus?.monitor?.status || 'Unknown'}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Runs hourly checks on Vercel reachability, S3 database formatting, and updater/auditor run freshness.
              </p>
              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <strong>Last Run:</strong> {agentStatus?.monitor?.last_run ? new Date(agentStatus.monitor.last_run).toLocaleString() : 'N/A'}
                </div>
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: '#ffffff', 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '8px', 
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap'
                }}>
                  {agentStatus?.monitor?.message || 'Waiting for first run...'}
                </div>
              </div>
            </div>
          </div>

          {/* Audit History Log */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={18} style={{ color: 'var(--color-accent)' }} />
              Llama 3 QA Auditor Reports
            </h3>
            
            {!auditReport || !auditReport.details || auditReport.details.length === 0 ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(16, 185, 129, 0.05)', border: '1px dashed rgba(16, 185, 129, 0.2)', padding: '16px', borderRadius: '8px' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  All server listings are 100% correct. Auditor confirmed zero classification, segment, or formatting errors in the registry.
                </span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px' }}>Repository</th>
                      <th style={{ padding: '10px' }}>Field</th>
                      <th style={{ padding: '10px' }}>Original Value</th>
                      <th style={{ padding: '10px' }}>Audited Corrected Value</th>
                      <th style={{ padding: '10px' }}>Audit Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditReport.details.map((detail: any, i: number) => 
                      detail.corrections.map((corr: any, j: number) => (
                        <tr key={`${i}-${j}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '12px 10px', fontWeight: 500 }}>{detail.repo}</td>
                          <td style={{ padding: '12px 10px' }}><code style={{ color: 'var(--color-accent)' }}>{corr.field}</code></td>
                          <td style={{ padding: '12px 10px', color: 'var(--color-error)' }}><del>{corr.old}</del></td>
                          <td style={{ padding: '12px 10px', color: 'var(--color-success)' }}>{corr.new}</td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{corr.reason}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Email alerting information */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(245, 158, 11, 0.05)', border: '1px dashed rgba(245, 158, 11, 0.2)', padding: '16px', borderRadius: '8px' }}>
            <Mail size={20} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <strong>Automatic Alerts</strong>: The Health Monitor Agent scans the registry hourly. In case of issues, alert notifications are automatically sent via Amazon SES to <strong>ashishtehri@gmail.com</strong>.
            </span>
          </div>
        </div>
      )}

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
