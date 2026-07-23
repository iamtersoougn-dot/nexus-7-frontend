import { useState, useEffect, useRef } from 'react';
import { Shield, Terminal, Cpu, Send, Loader2, Calculator, Scale, Code2, Network, Activity, Database, Server, Map, FileCode2, Code, Download, Layers, MessageSquare, TerminalSquare, Bot, User, Play, ChevronRight, GitBranch, RefreshCw, Monitor, Zap, Navigation, Building2, Key } from 'lucide-react';
import { dispatchTask } from './services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface TelemetryLog {
  id: string;
  tenantId?: string;
  agentRole?: string;
  action?: string;
  directive?: string;
  status?: string;
  timestamp?: string | FirestoreTimestamp;
}

interface InterceptedAttack {
  id: string;
  timestamp: string;
  directive: string;
  reason: string;
  agentTarget: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
}

const agentRegistry = [
  {
    id: 'gateway',
    name: 'Gateway Router & Dispatcher',
    role: 'Orchestration Router',
    desc: 'Coordinates ingress tasks, analyzes request intent, and routes to specialized administrative nodes.',
    context: 'You are the Gateway Router & Dispatcher. Your primary function is to parse ingress intent, route administrative payloads to the correct sub-nodes, and maintain orchestrator stability across the municipal tenant context.',
    runs: 204,
    success: 99.1,
    icon: <Network className="h-5 w-5 text-indigo-400" />
  },
  {
    id: 'auditor',
    name: 'Municipal Financial Auditor',
    role: 'Lead Finance Agent',
    desc: 'Specializes in municipal budget audits, identifying ledger anomalies, and analyzing public expenditure.',
    context: 'You are the Municipal Financial Auditor. Scan public ledgers, identify anomalous expenditure, evaluate budget limits, and flag unauthorized fund allocation in accordance with financial regulations.',
    runs: 142,
    success: 98.4,
    icon: <Calculator className="h-5 w-5 text-emerald-400" />
  },
  {
    id: 'compliance',
    name: 'Regulatory Compliance Officer',
    role: 'Legal Compliance Guard',
    desc: 'Audits public procurement tenders, state contracts, and organizational statutory procedures.',
    context: 'You are the Regulatory Compliance Officer. Review legal frameworks, procurement contracts, and municipal vendor agreements. Ensure strict compliance with administrative statutory policies.',
    runs: 88,
    success: 100.0,
    icon: <Scale className="h-5 w-5 text-amber-400" />
  },
  {
    id: 'validator',
    name: 'Dedicated Code & Schema Validator',
    role: 'Syntax & RLS Compliance Validator',
    desc: 'Verifies syntactic correctness, RLS policy integrity, and structural JSON/TS schema compliance.',
    context: 'You are the Technical Core Syntax & RLS Validator. Analyze source code blocks and Database Row-Level Security definitions for insecure boundaries or architectural anti-patterns.',
    runs: 156,
    success: 98.8,
    icon: <Code2 className="h-5 w-5 text-blue-400" />
  },
  {
    id: 'watchdog',
    name: 'Telemetry Watchdog & Anomaly Detector',
    role: 'Threat & Log Telemetry Watchdog',
    desc: 'Audits system log streams and rate-limiting buffers to identify access violations, RLS boundary breaches, and anomalies.',
    context: 'You are the Telemetry Watchdog & Anomaly Detection Agent. Scan operational logs and telemetry records for DoS spikes, tenant crossing attempts, and anomalous traffic patterns.',
    runs: 189,
    success: 99.6,
    icon: <Activity className="h-5 w-5 text-rose-400" />
  },
  {
    id: 'zoning',
    name: 'Zoning & Permitting Expert',
    role: 'Land Usage Expert',
    desc: 'Evaluates land use applications, parcel divisions, and environmental assessments against zoning codes.',
    context: 'You are the Zoning & Permitting Expert. Evaluate land applications and geographic coordinates against active municipal ordinances, zoning maps, and environmental impact rules.',
    runs: 94,
    success: 98.2,
    icon: <Map className="h-5 w-5 text-orange-400" />
  },
  {
    id: 'compiler',
    name: 'Node 05: AI Compiler',
    role: 'AST Code Compiler',
    desc: 'Transforms raw LLM output fragments and pseudo-code directives into executable Abstract Syntax Trees.',
    context: 'You are the Node 05 AST Compiler. Ingest semantic directives and raw AI fragments to construct valid, executable code modules and abstract syntax trees.',
    runs: 312,
    success: 99.9,
    icon: <FileCode2 className="h-5 w-5 text-cyan-400" />
  },
  {
    id: 'grid_optimizer',
    name: 'Smart Grid & Load Optimizer',
    role: 'Energy Telemetry Node',
    desc: 'Analyzes smart-plug hardware telemetry to predict grid outages and automate smart energy load switching for regional environments.',
    context: 'You are the Smart Grid & Load Optimizer. Interface with smart-plug telemetry, predict regional grid outages, and execute automated energy load switching protocols to maintain operational continuity.',
    runs: 67,
    success: 99.2,
    icon: <Zap className="h-5 w-5 text-yellow-400" />
  },
  {
    id: 'route_intel',
    name: 'Route Intelligence Dispatcher',
    role: 'Logistics & Mapping AI',
    desc: 'Ingests real-time driver voice notes and spatial data to generate localized mapping and automated routing intelligence.',
    context: 'You are the Route Intelligence Dispatcher. Process real-time localized traffic data and ingest automated driver voice notes to generate dynamic mapping intelligence and municipal routing commands.',
    runs: 412,
    success: 97.8,
    icon: <Navigation className="h-5 w-5 text-blue-500" />
  },
  {
    id: 'erp_admin',
    name: 'Institutional ERP Administrator',
    role: 'Microservices Coordinator',
    desc: 'Monitors decoupled microservices and APIs for enterprise resource planning across educational and public sector institutions.',
    context: 'You are the Institutional ERP Administrator. Monitor the decoupled microservices architecture of institutional enterprise resource planning systems. Manage API connections and sync operational flows.',
    runs: 289,
    success: 98.9,
    icon: <Building2 className="h-5 w-5 text-purple-400" />
  },
  {
    id: 'prop_security',
    name: 'Property Security Coordinator',
    role: 'Hospitality Integration Node',
    desc: 'Manages niche booking infrastructures, oversees phased deployment operations, and coordinates boutique property security protocols.',
    context: 'You are the Property Security Coordinator. Oversee automated booking logic and security infrastructure deployment for boutique physical properties. Ensure access logs are strictly audited.',
    runs: 134,
    success: 100.0,
    icon: <Key className="h-5 w-5 text-rose-500" />
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  // Sandbox Execution State
  const [directive, setDirective] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Telemetry & Security State
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [interceptedAttacks, setInterceptedAttacks] = useState<InterceptedAttack[]>([]);

  // Code Ingestion State
  const [ingestionCode, setIngestionCode] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilerOutput, setCompilerOutput] = useState<string | null>(null);

  // Command Palette State
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const currentAgent = agentRegistry.find(a => a.id === selectedAgentId);

  // Keyboard Palette Logic (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsPaletteOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  // Clean Agent Selection Handler
  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
    const agent = agentRegistry.find(a => a.id === agentId);
    if (agent) {
      setChatLog([{
        id: 'init-msg',
        role: 'agent',
        text: `Greetings! I am your ${agent.role}. Chat with me directly to execute administrative tasks, review telemetry, or process operational routines.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setDirective('');
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directive.trim() || !currentAgent) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: directive,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatLog(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    try {
      const result = await dispatchTask(directive, currentAgent.name);
      
      const agentMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        text: result.data,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setChatLog(prev => [...prev, agentMessage]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const agentError: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        text: `[SYSTEM ERROR] ${errorMessage}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setChatLog(prev => [...prev, agentError]);

      if (errorMessage.includes('[GUARD')) {
        setInterceptedAttacks(prev => [{
          id: Date.now().toString() + Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString(),
          directive: directive,
          reason: errorMessage.replace('Error: ', ''),
          agentTarget: currentAgent.name
        }, ...prev]);
      }
    } finally {
      setIsProcessing(false);
      setDirective('');
    }
  };

  const handleCompile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestionCode.trim()) return;
    setIsCompiling(true);
    setCompilerOutput(`[NODE 05] Ingesting raw token stream...\n[NODE 05] Initiating AST Compilation Phase...`);
    try {
      const result = await dispatchTask(ingestionCode, 'Dedicated Code & Schema Validator');
      setCompilerOutput(`[COMPILATION SUCCESS] Output Generated:\n\n${result.data}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setCompilerOutput(`[COMPILATION FAILED] Error during ingestion: ${errorMessage}`);
    } finally {
      setIsCompiling(false);
    }
  };

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const response = await fetch('/api/orchestrator/logs');
      if (response.ok) {
        const data = await response.json();
        setTelemetryLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Network error while fetching logs:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'telemetry') {
      const deferredFetch = setTimeout(() => {
        fetchLogs();
      }, 0);
      return () => clearTimeout(deferredFetch);
    }
  }, [activeTab]);

  const formatTimestamp = (ts: string | FirestoreTimestamp | unknown) => {
    if (!ts) return 'Unknown Time';
    if (typeof ts === 'object' && ts !== null && '_seconds' in ts) {
      const firestoreTime = ts as FirestoreTimestamp;
      return new Date(firestoreTime._seconds * 1000).toLocaleString();
    }
    if (typeof ts === 'string') {
      return new Date(ts).toLocaleString();
    }
    return 'Unknown Time';
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-zinc-800 text-[13px] overflow-hidden">
      
      {/* GLOBAL HEADER */}
      <header className="flex-none border-b border-zinc-800 bg-zinc-950 px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-md z-10">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold tracking-widest uppercase text-sm text-zinc-100">NEXUS-7 ARCHITECT</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-emerald-400 font-mono font-medium tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">v2.4.0-STABLE</span>
              <span className="text-[9px] text-zinc-500 font-mono uppercase">Mission-Critical OS // Multi-Agent Portal</span>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-2 overflow-x-auto pb-2 xl:pb-0 hide-scrollbar flex-1 xl:justify-center">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${activeTab === 'dashboard' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-zinc-400 hover:bg-zinc-900 border border-transparent'}`}>
            <Cpu className="h-4 w-4" /> Control Room
          </button>
          <button onClick={() => setActiveTab('guard')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${activeTab === 'guard' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-zinc-400 hover:bg-zinc-900 border border-transparent'}`}>
            <Shield className="h-4 w-4" /> Guard Center
          </button>
          <button onClick={() => setActiveTab('telemetry')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${activeTab === 'telemetry' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-zinc-400 hover:bg-zinc-900 border border-transparent'}`}>
            <Terminal className="h-4 w-4" /> Telemetry Logs
          </button>
          <button onClick={() => setActiveTab('ingestion')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${activeTab === 'ingestion' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-zinc-400 hover:bg-zinc-900 border border-transparent'}`}>
            <Code className="h-4 w-4" /> Code Ingestion
          </button>
          <button onClick={() => setActiveTab('blueprint')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${activeTab === 'blueprint' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-zinc-400 hover:bg-zinc-900 border border-transparent'}`}>
            <Layers className="h-4 w-4" /> Arch Blueprint
          </button>
        </nav>

        <div className="hidden xl:flex items-center gap-6">
          <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold tracking-widest uppercase">99.98% Uptime</span>
          </div>
          <div className="h-8 w-px bg-zinc-800"></div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-zinc-200 leading-tight">Admin_01</p>
              <p className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest">Lead Solutions Eng</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 shadow-inner">
              <User className="h-4 w-4" />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/20 via-zinc-950 to-zinc-950 p-6 md:p-10 hide-scrollbar">
        <div className="max-w-7xl mx-auto pb-10">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-10">
              
              {/* HUD Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 shadow-lg">
                  <div className="flex justify-between items-start mb-6">
                    <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest">Tenant & RLS Scope</p>
                    <Shield className="h-5 w-5 text-emerald-500/70" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-100 font-mono">tenant_admin_muni_01</h3>
                    <p className="text-sm text-emerald-400 mt-2 flex items-center gap-2 font-medium">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span> RLS Active & Enforced
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 shadow-lg">
                  <div className="flex justify-between items-start mb-6">
                    <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest">Throttler Rate Limit (Redis)</p>
                    <Activity className="h-5 w-5 text-blue-500/70" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-zinc-100 font-mono flex items-baseline gap-2">
                      21 <span className="text-sm text-zinc-500 font-sans font-medium">/ 25 remaining</span>
                    </h3>
                    <div className="w-full bg-zinc-800 h-1.5 mt-4 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full w-[84%]"></div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 shadow-lg">
                  <div className="flex justify-between items-start mb-6">
                    <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest">Database Latency (PostgreSQL)</p>
                    <Database className="h-5 w-5 text-cyan-500/70" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-zinc-100 font-mono flex items-baseline gap-2">
                      12 <span className="text-sm text-zinc-500 font-sans font-medium">ms avg</span>
                    </h3>
                    <p className="text-xs text-cyan-400 mt-4 flex items-center gap-2 font-mono">
                      <Server className="h-3.5 w-3.5" /> 3 safe connection pools active
                    </p>
                  </div>
                </div>
              </div>

              {/* AUTONOMOUS AGENT REGISTRY */}
              <div className="bg-zinc-900/20 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-200 font-mono">Autonomous Agent Registry</h2>
                </div>
                <p className="text-[11px] text-zinc-500 font-mono mb-6">Tenant Isolated active administrative intelligence routines.</p>

                <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x">
                  {agentRegistry.map((agent) => {
                    const isSelected = selectedAgentId === agent.id;
                    return (
                      <div 
                        key={agent.id} 
                        onClick={() => handleAgentSelect(agent.id)}
                        className={`min-w-[320px] max-w-[320px] snap-center bg-zinc-900/40 border rounded-xl p-5 transition-all flex flex-col justify-between min-h-[180px] cursor-pointer group ${
                          isSelected 
                            ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] bg-zinc-900/80' 
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2.5 rounded-lg border transition-colors ${isSelected ? 'bg-indigo-950/40 border-indigo-500/40' : 'bg-zinc-950 border-zinc-800'}`}>
                            {agent.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h3 className="font-bold text-zinc-100 text-xs leading-tight">{agent.name}</h3>
                              <span className={`text-[8px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded font-bold ${isSelected ? 'bg-indigo-500 text-white' : 'text-zinc-600 bg-zinc-800'}`}>
                                {isSelected ? 'ACTIVE' : 'IDLE'}
                              </span>
                            </div>
                            <p className="text-[9px] font-mono text-zinc-500 mt-1">{agent.role}</p>
                          </div>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed mt-3 flex-1 line-clamp-3">
                          {agent.desc}
                        </p>
                        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                          <div>
                            <p className="text-[8px] text-zinc-500 font-mono uppercase tracking-widest mb-0.5">Executed</p>
                            <p className="text-xs font-bold text-zinc-200">{agent.runs} audits</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] text-zinc-500 font-mono uppercase tracking-widest mb-0.5">Success Rate</p>
                            <p className="text-xs font-bold text-emerald-400">{agent.success}%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DYNAMIC SANDBOX AREA */}
              {!currentAgent ? (
                <div className="border border-zinc-800/50 bg-zinc-900/10 rounded-2xl h-80 flex flex-col items-center justify-center p-8 text-center mt-4">
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-4 shadow-inner">
                    <Cpu className="h-10 w-10 text-zinc-600" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-300 font-mono tracking-widest uppercase mb-2">No Agent Selected</h3>
                  <p className="text-xs text-zinc-500 font-mono max-w-md leading-relaxed">
                    Select an active administrative intelligence routine from the registry above to establish an execution sandbox node.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
                  
                  {/* LEFT PANE: Command & Context Input */}
                  <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="bg-zinc-900/30 border border-indigo-500/20 rounded-xl p-5 shadow-inner">
                      <h3 className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold mb-3">
                        ACTIVE CONTEXT: {currentAgent.name}
                      </h3>
                      <p className="text-xs text-zinc-300 font-mono leading-relaxed opacity-90">
                        {currentAgent.context}
                      </p>
                    </div>

                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex-1 flex flex-col">
                      <h3 className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 mb-4 font-mono text-zinc-200">
                        <ChevronRight className="h-4 w-4 text-cyan-500" /> ADMINISTRATIVE COMMAND INPUT
                      </h3>
                      
                      <label htmlFor="admin-directive" className="text-[10px] text-zinc-500 font-mono font-bold mb-2 uppercase">Prompt / Administrative Directives</label>
                      <textarea
                        id="admin-directive"
                        name="adminDirective"
                        value={directive}
                        onChange={(e) => setDirective(e.target.value)}
                        placeholder="Enter command execution directives here..."
                        disabled={isProcessing}
                        className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none shadow-inner mb-4"
                      />

                      <div className="text-[10px] text-zinc-500 font-mono font-bold mb-2 uppercase flex items-center gap-1">
                        <Layers className="h-3 w-3" /> Select Scenario Template
                      </div>
                      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-[11px] font-mono text-indigo-300 border-l-2 border-l-indigo-500 cursor-pointer hover:bg-zinc-900 transition-colors mb-6 truncate">
                        → Audit threat signatures and high-frequency access patterns...
                      </div>

                      <div className="mt-auto">
                        <button
                          onClick={handleDispatch}
                          disabled={isProcessing || !directive.trim()}
                          className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 py-3 rounded-lg text-[11px] font-bold tracking-widest uppercase transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3 w-3" />}
                          Dispatch Agent Routine
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT PANE: Interactive Chat */}
                  <div className="lg:col-span-7 bg-zinc-900/40 border border-zinc-800 rounded-xl flex flex-col overflow-hidden shadow-xl min-h-[500px]">
                    <div className="bg-zinc-950 px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                          <Bot className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-zinc-100">{currentAgent.name}</h2>
                          <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">
                            SECURE AGENT TERMINAL // TENANT_ADMIN_MUNI_01
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] bg-blue-900/30 text-blue-400 px-2 py-1 border border-blue-800/50 rounded uppercase tracking-widest font-mono">
                        {currentAgent.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800/50 bg-zinc-900/50">
                      <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-700/50 text-xs font-bold text-zinc-200">
                        <MessageSquare className="h-3.5 w-3.5" /> Interactive Chat
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-zinc-500">
                        <TerminalSquare className="h-3.5 w-3.5" /> Sandbox Executor
                      </div>
                    </div>
                    
                    <div className="px-5 py-2 bg-zinc-950/40 border-b border-zinc-800/50 flex items-center justify-between text-[10px] font-mono font-bold">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
                        RLS SECURE CHANNEL
                      </div>
                      <div className="text-zinc-500">ID: <span className="text-zinc-300">district_01_muni</span></div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6 hide-scrollbar relative bg-[linear-gradient(rgba(24,24,27,0.5)1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.5)1px,transparent_1px)] bg-[size:20px_20px]">
                      {chatLog.map((msg) => (
                        <div key={msg.id} className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                          <div className={`mt-1 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center border ${msg.role === 'agent' ? 'bg-indigo-950/50 border-indigo-500/30 text-indigo-400' : 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>
                            {msg.role === 'agent' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                          </div>
                          <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                              msg.role === 'agent' 
                                ? msg.text.includes('[SYSTEM ERROR]') 
                                  ? 'bg-rose-950/20 border border-rose-900/30 text-rose-300' 
                                  : 'bg-zinc-800/40 border border-zinc-700/50 text-zinc-200 rounded-tl-none' 
                                : 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/10'
                            }`}>
                              {msg.role === 'agent' && !msg.text.includes('Greetings') ? (
                                <div className="prose prose-invert max-w-none text-xs font-mono leading-relaxed overflow-x-auto 
                                                [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:border [&_table]:border-zinc-800 
                                                [&_th]:bg-zinc-900 [&_th]:p-2 [&_th]:border [&_th]:border-zinc-800 [&_th]:text-left [&_th]:text-indigo-400 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider 
                                                [&_td]:p-2 [&_td]:border [&_td]:border-zinc-800/60 [&_td]:text-zinc-300 [&_td]:text-[11px]
                                                [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-zinc-100 [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:uppercase [&_h3]:tracking-wider
                                                [&_hr]:border-zinc-800 [&_hr]:my-4
                                                [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1
                                                [&_strong]:text-indigo-300">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.text}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                msg.text
                              )}
                            </div>
                            <span className="text-[9px] font-mono text-zinc-600 mt-1.5 px-1">{msg.timestamp}</span>
                          </div>
                        </div>
                      ))}
                      {isProcessing && (
                        <div className="flex gap-4 max-w-[80%] animate-pulse">
                          <div className="mt-1 h-8 w-8 rounded-full flex items-center justify-center border bg-indigo-950/50 border-indigo-500/30 text-indigo-400">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="p-4 rounded-2xl rounded-tl-none bg-zinc-800/40 border border-zinc-700/50 flex items-center gap-2">
                             <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                             <span className="text-[11px] font-mono text-zinc-500">Processing directive...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 bg-zinc-950 border-t border-zinc-800">
                      <form onSubmit={handleDispatch} className="relative flex items-center">
                        <input
                          id="chat-input"
                          name="chatInput"
                          aria-label="Interactive chat input"
                          type="text"
                          value={directive}
                          onChange={(e) => setDirective(e.target.value)}
                          disabled={isProcessing}
                          placeholder={`Send audit instruction directly to ${currentAgent.name}...`}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-full pl-5 pr-12 py-3 text-xs font-medium text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                        />
                        <button
                          type="submit"
                          disabled={isProcessing || !directive.trim()}
                          className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-full transition-colors"
                        >
                           <Send className="h-3.5 w-3.5" />
                        </button>
                      </form>
                      <div className="flex justify-between items-center mt-2 px-2">
                         <span className="text-[9px] font-mono text-indigo-500/70 flex items-center gap-1">
                           <Activity className="h-3 w-3" /> Interactive Chat Proxy: Gemini 3.5 Active
                         </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GUARD CENTER */}
          {activeTab === 'guard' && (
             <div className="space-y-6">
               <div>
                 <h2 className="text-lg font-semibold tracking-tight uppercase">Guard Center Firewall</h2>
                 <p className="text-xs text-zinc-500 font-mono mt-1">Real-time request scrubbing, rate limiting, and prompt injection interception.</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                 <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-xl">
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-2">Threats Blocked</p>
                    <p className="text-3xl font-bold text-rose-400">{interceptedAttacks.length}</p>
                 </div>
                 <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-xl">
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-2">Active Perimeter</p>
                    <p className="text-lg font-medium text-emerald-400 mt-1 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Online & Enforcing
                    </p>
                 </div>
                 <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-xl">
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-2">Rate Limit Threshold</p>
                    <p className="text-lg font-medium text-zinc-300 mt-1">5 req / 60 seconds</p>
                 </div>
              </div>
              <div className="rounded-xl bg-zinc-900/40 border border-red-900/30 overflow-hidden shadow-xl">
                {interceptedAttacks.length === 0 ? (
                  <div className="p-16 text-center text-zinc-500 font-mono text-sm">
                    Perimeter secure. No malicious traffic or spam detected in this session.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-red-950/20 border-b border-red-900/30 text-[10px] font-mono text-rose-500/70 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Intercept Time</th>
                          <th className="px-6 py-4 font-semibold">Target Node</th>
                          <th className="px-6 py-4 font-semibold">Malicious Payload</th>
                          <th className="px-6 py-4 font-semibold">Firewall Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {interceptedAttacks.map((attack) => (
                          <tr key={attack.id} className="hover:bg-red-950/10 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                              {new Date(attack.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-zinc-300">
                              {attack.agentTarget}
                            </td>
                            <td className="px-6 py-4 text-zinc-300 font-medium">
                              <div className="max-w-xs truncate text-rose-200/70 font-mono text-xs" title={attack.directive}>
                                {attack.directive}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                BLOCKED: {attack.reason}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TELEMETRY LOGS */}
          {activeTab === 'telemetry' && (
             <div className="space-y-6">
             <div className="flex items-center justify-between">
               <div>
                 <h2 className="text-lg font-semibold tracking-tight uppercase">Gateway Audit Trail Viewport</h2>
                 <p className="text-xs text-zinc-500 font-mono mt-1">Live, immutable record of all orchestration events and agent transactions.</p>
               </div>
               <button 
                 onClick={fetchLogs} 
                 disabled={isLoadingLogs}
                 className="flex items-center gap-2 text-xs bg-zinc-800 border border-zinc-700 px-4 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors disabled:opacity-50 cursor-pointer shadow-md"
               >
                 {isLoadingLogs ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                 Refresh Sync
               </button>
             </div>
             <div className="rounded-xl bg-zinc-900/40 border border-zinc-800 overflow-hidden shadow-xl">
               {isLoadingLogs && telemetryLogs.length === 0 ? (
                 <div className="p-16 flex flex-col justify-center items-center text-zinc-500 space-y-4">
                   <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                   <p className="text-xs font-mono">Synchronizing telemetry stream from Firestore...</p>
                 </div>
               ) : telemetryLogs.length === 0 ? (
                 <div className="p-16 text-center text-zinc-500 font-mono text-sm border-t border-zinc-800">
                   No active telemetry logs detected in database.
                 </div>
               ) : (
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm whitespace-nowrap">
                     <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                       <tr>
                         <th className="px-6 py-4 font-semibold">Event Timestamp</th>
                         <th className="px-6 py-4 font-semibold">Active Agent Node</th>
                         <th className="px-6 py-4 font-semibold">Executed Directive</th>
                         <th className="px-6 py-4 font-semibold text-right">Status Check</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-zinc-800/50">
                       {telemetryLogs.map((log) => (
                         <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                           <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                             {formatTimestamp(log.timestamp)}
                           </td>
                           <td className="px-6 py-4">
                             <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-indigo-500/20 bg-indigo-500/10 text-xs font-medium text-indigo-400">
                               {log.agentRole}
                             </span>
                           </td>
                           <td className="px-6 py-4 text-zinc-300 font-medium">
                             <div className="max-w-md truncate" title={log.directive}>
                               {log.directive || log.action}
                             </div>
                           </td>
                           <td className="px-6 py-4 text-right">
                             <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                               {log.status || 'SUCCESS'}
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
             </div>
           </div>
          )}

          {/* CODE INGESTION */}
          {activeTab === 'ingestion' && (
             <div className="space-y-6 max-w-4xl mx-auto">
             <div>
               <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-3">
                 <Code className="h-6 w-6 text-cyan-400" /> NODE 05: CODE INGESTION PORTAL
               </h2>
               <p className="text-xs text-zinc-500 font-mono mt-2">Ingest raw AI generations or snippets to run statutory compliance compilation.</p>
             </div>
             <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-8 shadow-xl mt-8">
               <form onSubmit={handleCompile} className="space-y-6">
                 <div>
                   <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-widest mb-3">Target Compilation Model:</label>
                   <div className="bg-black/50 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-200 font-medium flex items-center justify-between shadow-inner">
                     Node 05: AI Compiler (AST Code Compiler)
                     <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"></span>
                   </div>
                 </div>
                 <div>
                   <div className="flex justify-between items-end mb-3">
                     
                     <label htmlFor="ingestion-input" className="block text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Raw AI Studio Outputs / Fragment:</label>
                     <button type="button" className="text-[10px] flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-mono transition-colors font-bold">
                       <Download className="h-3.5 w-3.5" /> SELECT FILE
                     </button>
                   </div>
                   <div className="relative">
                     <textarea
                       id="ingestion-input"
                       name="ingestionInput"
                       value={ingestionCode}
                       onChange={(e) => setIngestionCode(e.target.value)}
                       disabled={isCompiling}
                       placeholder="Paste raw LLM response chunks, prompt specifications, or drag-and-drop code files here..."
                       className="w-full h-80 bg-black/40 border-2 border-dashed border-zinc-700 rounded-xl p-6 text-sm font-mono text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 hover:border-zinc-600 transition-colors disabled:opacity-50 resize-none shadow-inner"
                     ></textarea>
                     {!ingestionCode && (
                       <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-zinc-600 opacity-40">
                         <FileCode2 className="h-10 w-10 mb-3" />
                         <span className="text-[11px] font-mono tracking-widest uppercase font-bold">DRAG AND DROP RAW TEXT FILE HERE</span>
                       </div>
                     )}
                   </div>
                 </div>
                 <button
                   type="submit"
                   disabled={isCompiling || !ingestionCode.trim()}
                   className="w-full bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-800/50 text-cyan-400 py-4 rounded-lg text-sm font-bold tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                 >
                   {isCompiling ? <Loader2 className="h-5 w-5 animate-spin" /> : '▷'} EXECUTE AI COMPILATION
                 </button>
               </form>
             </div>
             {compilerOutput && (
               <div className="bg-black/60 border border-cyan-900/30 rounded-xl p-6 mt-8 shadow-inner animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-4">
                   <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">AST Compiler Status Ledger</span>
                   <span className="text-[10px] bg-cyan-950/50 px-2 py-1 rounded font-mono text-cyan-400 border border-cyan-900/50 uppercase tracking-wider">Compilation Cycle Finished</span>
                 </div>
                 <pre className="text-sm font-mono text-zinc-300 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                   {compilerOutput}
                 </pre>
               </div>
             )}
           </div>
          )}

          {/* BLUEPRINT PORTAL */}
          {activeTab === 'blueprint' && (
            <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-500">
              <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
                <Layers className="h-8 w-8 text-indigo-500" />
                <div>
                  <h2 className="text-xl font-bold tracking-tight uppercase text-zinc-100">Enterprise Architectural Blueprints</h2>
                  <p className="text-xs text-zinc-500 font-mono mt-1">System topology mapping for the Nexus-7 Multi-Agent Orchestration Engine.</p>
                </div>
              </div>

              <div className="relative mt-12 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-10 overflow-hidden">
                {/* Background grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(24,24,27,0.5)1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.5)1px,transparent_1px)] bg-[size:20px_20px] opacity-20"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 max-w-4xl mx-auto">
                  
                  {/* Node 1: Client */}
                  <div className="flex flex-col items-center gap-3 w-40 z-10">
                    <div className="h-16 w-16 rounded-xl border-2 border-indigo-500/50 bg-indigo-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)] backdrop-blur-sm">
                      <Monitor className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-zinc-200">Client Terminal</p>
                      <p className="text-[9px] font-mono tracking-widest text-zinc-500 mt-1">React + Vite UI</p>
                    </div>
                  </div>

                  {/* Connection 1 */}
                  <div className="flex-1 h-px bg-indigo-500/30 relative hidden md:block">
                    <div className="absolute top-[-5px] w-3 h-3 bg-indigo-400 rounded-full shadow-[0_0_15px_rgba(129,140,248,1)] animate-[data-flow_2s_linear_infinite]"></div>
                  </div>

                  {/* Node 2: Gateway */}
                  <div className="flex flex-col items-center gap-3 w-40 z-10">
                    <div className="h-16 w-16 rounded-xl border-2 border-rose-500/50 bg-rose-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.2)] relative backdrop-blur-sm">
                      <Shield className="h-8 w-8 text-rose-400" />
                      <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">RLS</div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-zinc-200">Security Gateway</p>
                      <p className="text-[9px] font-mono tracking-widest text-zinc-500 mt-1">Node.js Firewall</p>
                    </div>
                  </div>

                  {/* Connection 2 */}
                  <div className="flex-1 h-px bg-cyan-500/30 relative hidden md:block">
                    <div className="absolute top-[-5px] w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,1)] animate-[data-flow_2s_linear_infinite_0.6s]"></div>
                  </div>

                  {/* Node 3: LLM Engine */}
                  <div className="flex flex-col items-center gap-3 w-40 z-10">
                    <div className="h-16 w-16 rounded-xl border-2 border-cyan-500/50 bg-cyan-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)] backdrop-blur-sm">
                      <Cpu className="h-8 w-8 text-cyan-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-zinc-200">Orchestrator</p>
                      <p className="text-[9px] font-mono tracking-widest text-zinc-500 mt-1">Gemini 3.5 API</p>
                    </div>
                  </div>

                  {/* Connection 3 */}
                  <div className="flex-1 h-px bg-emerald-500/30 relative hidden md:block">
                    <div className="absolute top-[-5px] w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,1)] animate-[data-flow_2s_linear_infinite_1.2s]"></div>
                  </div>

                  {/* Node 4: Database */}
                  <div className="flex flex-col items-center gap-3 w-40 z-10">
                    <div className="h-16 w-16 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)] backdrop-blur-sm">
                      <Database className="h-8 w-8 text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-zinc-200">Telemetry DB</p>
                      <p className="text-[9px] font-mono tracking-widest text-zinc-500 mt-1">Firebase Admin</p>
                    </div>
                  </div>
                </div>

                {/* Legend/Log */}
                <div className="relative z-10 mt-16 bg-black/40 border border-zinc-800 rounded-lg p-6 max-w-4xl mx-auto backdrop-blur-md">
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4">Pipeline Execution Log</h3>
                  <div className="space-y-3 font-mono text-[10px]">
                    <div className="flex items-center gap-3 text-zinc-400"><span className="text-indigo-400 font-bold">01</span> Client dispatches instruction via REST API.</div>
                    <div className="flex items-center gap-3 text-zinc-400"><span className="text-rose-400 font-bold">02</span> Express middleware scrubs payload against threat signatures.</div>
                    <div className="flex items-center gap-3 text-zinc-400"><span className="text-cyan-400 font-bold">03</span> Node maps intent to Gemini System Persona & dispatches prompt.</div>
                    <div className="flex items-center gap-3 text-zinc-400"><span className="text-emerald-400 font-bold">04</span> Successful execution & latency metrics logged to Firestore.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* GLOBAL FOOTER */}
      <footer className="flex-none bg-zinc-950 border-t border-zinc-900 px-6 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-widest text-zinc-500 z-10">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span> 
            LIVE NODE SESSION: ARCH-00234
          </span>
          <span className="text-zinc-700 hidden md:inline">//</span>
          <span className="text-zinc-400">SECURE: SHA-256</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <Database className="h-3 w-3 text-blue-500/70" /> 
            REDIS CLUSTER: <span className="text-emerald-400 font-bold">ACTIVE</span>
          </span>
          <span className="flex items-center gap-1.5">
            <GitBranch className="h-3 w-3 text-indigo-500/70" /> 
            CI/CD PIPELINE: <span className="text-emerald-400 font-bold">STABLE</span>
          </span>
        </div>
      </footer>

      {/* COMMAND PALETTE (CTRL + K) */}
      {isPaletteOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex pt-[10vh] justify-center backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl h-fit animate-in fade-in zoom-in-95 duration-200">
             <div className="p-4 border-b border-zinc-800 flex items-center gap-3 text-zinc-400">
               <Terminal className="h-4 w-4" />
               <input 
                 id="palette-search"
                 name="paletteSearch"
                 aria-label="Command palette search"
                 autoFocus 
                 placeholder="Search commands, agents, or navigation..." 
                 className="flex-1 bg-transparent outline-none text-zinc-100 placeholder:text-zinc-600 font-mono text-sm" 
               />
             </div>
             <div className="py-2">
               <button onClick={() => { setActiveTab('dashboard'); setIsPaletteOpen(false); }} className="w-full px-5 py-3 text-left text-sm text-zinc-300 hover:bg-indigo-900/20 hover:text-indigo-300 flex items-center gap-3 transition-colors cursor-pointer">
                 <Cpu className="h-4 w-4" /> Go to Control Room
               </button>
               <button onClick={() => { setActiveTab('guard'); setIsPaletteOpen(false); }} className="w-full px-5 py-3 text-left text-sm text-zinc-300 hover:bg-indigo-900/20 hover:text-indigo-300 flex items-center gap-3 transition-colors cursor-pointer">
                 <Shield className="h-4 w-4" /> Open Guard Center Firewall
               </button>
               <button onClick={() => { setActiveTab('telemetry'); setIsPaletteOpen(false); }} className="w-full px-5 py-3 text-left text-sm text-zinc-300 hover:bg-indigo-900/20 hover:text-indigo-300 flex items-center gap-3 transition-colors cursor-pointer">
                 <Database className="h-4 w-4" /> View Telemetry Logs
               </button>
               <button onClick={() => { setActiveTab('blueprint'); setIsPaletteOpen(false); }} className="w-full px-5 py-3 text-left text-sm text-zinc-300 hover:bg-indigo-900/20 hover:text-indigo-300 flex items-center gap-3 transition-colors cursor-pointer">
                 <Layers className="h-4 w-4" /> View Arch Blueprint
               </button>
             </div>
             <div className="bg-zinc-950 px-4 py-3 border-t border-zinc-800 text-[10px] font-mono text-zinc-500 flex justify-between items-center">
               <span>Global Command Palette</span>
               <span>Press <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-400">ESC</kbd> to close</span>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}