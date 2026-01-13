'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, Settings as SettingsIcon, Key, ArrowLeft, ChevronDown, Sparkles } from 'lucide-react';
import { runChatTurn } from '@/lib/ai/client';

export default function AIChatWindow({ isOpen, onClose, context }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [provider, setProvider] = useState('openai');
    const [apiKey, setApiKey] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const messagesEndRef = useRef(null);

    // Load Settings
    useEffect(() => {
        const savedProvider = localStorage.getItem('ai_provider') || 'openai';
        setProvider(savedProvider);

        const key = localStorage.getItem(`ai_key_${savedProvider}`) || localStorage.getItem('openai_api_key') || '';
        setApiKey(key);

        // Initial greeting
        if (messages.length === 0) {
            setMessages([{
                role: 'assistant',
                content: "Hello. I am your Investment Assistant. I can analyze your portfolio, evaluate risks, and provide market insights. How can I help you today?"
            }]);
        }
    }, [isOpen]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Show settings if key is missing and window is open
    useEffect(() => {
        if (isOpen && !apiKey) {
            setShowSettings(true);
        }
    }, [isOpen, apiKey]);

    const handleSaveKey = (newKey, newProvider) => {
        setApiKey(newKey);
        setProvider(newProvider);
        localStorage.setItem(`ai_key_${newProvider}`, newKey);
        localStorage.setItem('ai_provider', newProvider);
        if (newProvider === 'openai') {
            localStorage.setItem('openai_api_key', newKey);
        }
        setShowSettings(false);
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        if (!apiKey) {
            setShowSettings(true);
            return;
        }

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        setStatus('Thinking...');

        try {
            const result = await runChatTurn(apiKey, [...messages, userMsg], context, setStatus, provider);

            if (result.error) {
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${result.error}` }]);
            } else {
                setMessages(result.history);
            }

        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error processing your request." }]);
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    const handleClose = () => {
        if (onClose && typeof onClose === 'function') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#09090b', // zinc-950 solid
                color: 'white',
                fontFamily: 'system-ui, sans-serif'
            }}
        >
            {/* Safe Area Top */}
            <div style={{ height: 'env(safe-area-inset-top, 0px)', backgroundColor: '#09090b' }} />

            {/* Header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                backgroundColor: '#09090b',
                borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: '8px',
                            marginLeft: '-8px',
                            borderRadius: '9999px',
                            cursor: 'pointer',
                            color: 'rgba(255,255,255,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        aria-label="Close"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid #000000',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                            <Sparkles size={20} color="#000000" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'white' }}>
                                AI Assistant
                            </h2>
                            <span style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Investment Analyst
                            </span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: '8px',
                        borderRadius: '9999px',
                        cursor: 'pointer',
                        color: 'rgba(255,255,255,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    aria-label="Settings"
                >
                    <SettingsIcon size={20} />
                </button>
            </header>

            {/* Messages Area */}
            <main style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 16px',
                backgroundColor: '#09090b'
            }}>
                <div style={{ maxWidth: '768px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {messages.map((msg, idx) => {
                        if (msg.role === 'system' || msg.role === 'tool') return null;
                        const isUser = msg.role === 'user';
                        return (
                            <div key={idx} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                                <div
                                    style={{
                                        maxWidth: '85%',
                                        borderRadius: '16px',
                                        padding: '14px 18px',
                                        fontSize: '15px',
                                        lineHeight: '1.6',
                                        backgroundColor: isUser ? '#2563eb' : '#18181b',
                                        color: 'white',
                                        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.06)',
                                        boxShadow: isUser ? '0 4px 14px rgba(37,99,235,0.2)' : 'none'
                                    }}
                                >
                                    {isUser ? (
                                        msg.content
                                    ) : (
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <ReactMarkdown
                                                components={{
                                                    p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
                                                    ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ul>,
                                                    li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                                                    strong: ({ children }) => <strong style={{ color: '#93c5fd' }}>{children}</strong>,
                                                    code: ({ children }) => <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }}>{children}</code>
                                                }}
                                            >
                                                {typeof msg.content === 'string' ? msg.content : 'Analyzing data...'}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {loading && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <div style={{
                                backgroundColor: '#18181b',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '16px',
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <div style={{ width: '6px', height: '6px', backgroundColor: '#3b82f6', borderRadius: '50%', animation: 'bounce 1s infinite' }} />
                                    <div style={{ width: '6px', height: '6px', backgroundColor: '#3b82f6', borderRadius: '50%', animation: 'bounce 1s infinite 0.15s' }} />
                                    <div style={{ width: '6px', height: '6px', backgroundColor: '#3b82f6', borderRadius: '50%', animation: 'bounce 1s infinite 0.3s' }} />
                                </div>
                                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{status}</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Input Area */}
            <footer style={{
                padding: '16px 20px',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                backgroundColor: '#09090b',
                borderTop: '1px solid rgba(255,255,255,0.08)'
            }}>
                <div style={{ maxWidth: '768px', margin: '0 auto', position: 'relative' }}>
                    <textarea
                        rows="1"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Ask about your portfolio..."
                        disabled={loading}
                        style={{
                            width: '100%',
                            backgroundColor: '#18181b',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px',
                            padding: '16px 56px 16px 20px',
                            fontSize: '16px',
                            outline: 'none',
                            resize: 'none',
                            minHeight: '56px',
                            maxHeight: '160px',
                            overflowY: 'auto',
                            fontFamily: 'inherit'
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            padding: '10px',
                            backgroundColor: loading || !input.trim() ? '#3f3f46' : '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: loading || !input.trim() ? 0.4 : 1
                        }}
                    >
                        <Send size={20} />
                    </button>
                </div>
                <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                    AI can make mistakes. Please verify important financial information.
                </p>
            </footer>

            {/* Settings Modal Overlay - Matches SettingsModal styling */}
            {showSettings && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    backgroundColor: '#09090b'
                }}>
                    <div style={{ width: '100%', maxWidth: '400px' }}>
                        {/* Header Card */}
                        <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            <h3 className="font-bold text-white">AI Agent Settings</h3>
                            <p className="text-xs text-blue-300/80">Manage your connection to the AI engine.</p>
                        </div>

                        {/* Provider Selection */}
                        <div className="flex flex-col gap-2 p-4 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <label className="text-muted text-xs font-semibold uppercase tracking-wider">AI Provider</label>
                            <select
                                value={provider}
                                onChange={(e) => {
                                    const p = e.target.value;
                                    const savedKey = localStorage.getItem(`ai_key_${p}`) || '';
                                    setProvider(p);
                                    setApiKey(savedKey);
                                }}
                                className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer mt-1"
                            >
                                <option value="openai">OpenAI</option>
                                <option value="gemini">Gemini</option>
                                <option value="claude">Claude</option>
                            </select>
                        </div>

                        {/* API Key Input - Same as Settings */}
                        <div className="flex flex-col gap-2 p-4 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <label className="text-muted text-xs font-semibold uppercase tracking-wider">
                                API Key ({provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Google' : 'Anthropic'})
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={
                                    provider === 'gemini' ? 'AIza...' :
                                        provider === 'claude' ? 'sk-ant-...' : 'sk-...'
                                }
                                className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <p className="text-xs text-muted mt-1">Your key is stored locally in your browser and used only to analyze your portfolio.</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="flex-1 p-4 rounded-xl text-white/70 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all font-medium"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSaveKey(apiKey, provider)}
                                className="flex-1 p-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold transition-all shadow-lg shadow-blue-900/30"
                            >
                                Save & Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
