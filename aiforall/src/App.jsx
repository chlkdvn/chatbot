import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'noir_convos'
const EXPIRY_DAYS = 7

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const cutoff = Date.now() - EXPIRY_DAYS * 86400000
    return JSON.parse(raw).filter(c => c.updatedAt > cutoff)
  } catch { return [] }
}

function saveConversations(c) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)) } catch {}
}

function genId() { return Math.random().toString(36).slice(2, 10) }

function timeLabel(ts) {
  const diff = Date.now() - ts
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  const d = Math.floor(diff / 86400000)
  return d === 1 ? 'Yesterday' : d < 7 ? `${d}d ago` : new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function App() {
  const [conversations, setConversations] = useState(() => loadConversations())
  const [activeId, setActiveId] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [error, setError] = useState(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const activeConvo = conversations.find(c => c.id === activeId) || null

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  useEffect(() => { saveConversations(conversations) }, [conversations])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [activeConvo?.messages, loading])
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  const newChat = useCallback(() => {
    const id = genId()
    setConversations(prev => [{ id, title: 'New chat', messages: [], createdAt: Date.now(), updatedAt: Date.now() }, ...prev])
    setActiveId(id)
    setSidebarOpen(false)
    setError(null)
  }, [])

  const deleteConvo = useCallback((id, e) => {
    e.stopPropagation()
    setConversations(prev => prev.filter(c => c.id !== id))
    setActiveId(prev => prev === id ? null : prev)
  }, [])

  const send = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setError(null)
    let cid = activeId
    if (!cid) {
      cid = genId()
      setConversations(prev => [{ id: cid, title: msg.slice(0, 42), messages: [], createdAt: Date.now(), updatedAt: Date.now() }, ...prev])
      setActiveId(cid)
    }
    const userMsg = { id: genId(), role: 'user', content: msg, ts: Date.now() }
    setConversations(prev => prev.map(c =>
      c.id === cid ? { ...c, messages: [...c.messages, userMsg], title: c.messages.length === 0 ? msg.slice(0, 42) : c.title, updatedAt: Date.now() } : c
    ))
    setLoading(true)
    try {
      const res = await fetch('http://localhost:5000/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Request failed')
      const botMsg = { id: genId(), role: 'assistant', content: data.response, ts: Date.now() }
      setConversations(prev => prev.map(c =>
        c.id === cid ? { ...c, messages: [...c.messages, botMsg], updatedAt: Date.now() } : c
      ))
    } catch (err) {
      setError(err.message || 'Cannot reach the server. Is it running?')
    } finally { setLoading(false) }
  }, [input, loading, activeId])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const suggestions = [
    'Explain quantum computing in simple terms',
    'Help me write a professional cold email',
    'What are the best productivity habits?',
    'Give me 5 startup ideas for Africa',
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&family=Geist+Mono:wght@400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; background: #0a0a0a; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }
        textarea { resize: none; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: .2; transform: scale(.75); }
          50%       { opacity: .9; transform: scale(1); }
        }
        .msg-in { animation: fadeUp .2s ease both; }
        .dot { animation: blink 1.3s ease-in-out infinite; }
        .dot:nth-child(2) { animation-delay: .17s; }
        .dot:nth-child(3) { animation-delay: .34s; }

        .convo-row:hover { background: #161616 !important; }
        .convo-row:hover .del-ico { opacity: 1 !important; }
        .suggest:hover { background: #141414 !important; border-color: #2e2e2e !important; }
        .send-btn:not([disabled]):hover { background: #e0e0e0 !important; }
        .send-btn[disabled] { opacity: .25; cursor: not-allowed; }
        .new-btn:hover { background: #161616 !important; }
        .hamburger:hover { background: #161616 !important; }
        .input-box:focus-within { border-color: #3a3a3a !important; }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: "'Geist', -apple-system, sans-serif", background: '#0a0a0a', color: '#e8e8e8' }}>

        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 20 }} />
        )}

        {/* ── SIDEBAR ── */}
        <aside style={{
          position: isMobile ? 'fixed' : 'relative',
          zIndex: 30, top: 0, left: 0, height: '100%', width: '252px',
          background: '#0f0f0f', borderRight: '1px solid #1c1c1c',
          display: 'flex', flexDirection: 'column',
          transform: (!isMobile || sidebarOpen) ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .26s cubic-bezier(.4,0,.2,1)',
        }}>
          {/* Logo */}
          <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #1c1c1c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#fff', letterSpacing: '-.2px' }}>Noir AI</span>
            </div>
            {isMobile && (
              <button onClick={() => setSidebarOpen(false)}
                style={{ background: 'none', border: 'none', color: '#555', padding: '4px', borderRadius: '5px', cursor: 'pointer', display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          {/* New chat */}
          <div style={{ padding: '10px 12px 6px' }}>
            <button onClick={newChat} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '7px',
              background: '#fff', color: '#0a0a0a', border: 'none', borderRadius: '8px',
              padding: '9px 14px', fontSize: '13px', fontWeight: '500',
              fontFamily: "'Geist', sans-serif", cursor: 'pointer',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New conversation
            </button>
          </div>

          {/* Convo list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
            {conversations.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#404040', textAlign: 'center', marginTop: '30px', lineHeight: 1.7 }}>No chats yet.<br/>Start one above.</p>
            ) : conversations.map(c => (
              <div key={c.id} className="convo-row"
                onClick={() => { setActiveId(c.id); setSidebarOpen(false); setError(null) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px',
                  borderRadius: '8px', cursor: 'pointer', marginBottom: '1px',
                  background: activeId === c.id ? '#1a1a1a' : 'transparent',
                  border: `1px solid ${activeId === c.id ? '#282828' : 'transparent'}`,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12.5px', fontWeight: activeId === c.id ? '500' : '400', color: activeId === c.id ? '#fff' : '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</p>
                  <p style={{ fontSize: '10px', color: '#454545', marginTop: '2px' }}>{timeLabel(c.updatedAt)}</p>
                </div>
                <button className="del-ico" onClick={(e) => deleteConvo(c.id, e)}
                  style={{ opacity: 0, background: 'none', border: 'none', color: '#444', padding: '2px', borderRadius: '4px', display: 'flex', cursor: 'pointer', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid #1c1c1c' }}>
            <p style={{ fontSize: '10px', color: '#383838', lineHeight: 1.7 }}>Chats deleted after {EXPIRY_DAYS} days.<br/>Stored on this device only.</p>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>

          {/* Header */}
          <header style={{ padding: '13px 20px', borderBottom: '1px solid #1c1c1c', background: '#0a0a0a', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {isMobile && (
              <button className="hamburger" onClick={() => setSidebarOpen(true)}
                style={{ background: 'none', border: 'none', color: '#666', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: '500', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeConvo ? activeConvo.title : 'Noir AI'}
              </p>
              {activeConvo && <p style={{ fontSize: '10.5px', color: '#454545', marginTop: '1px' }}>{activeConvo.messages.length} message{activeConvo.messages.length !== 1 ? 's' : ''}</p>}
            </div>
            {activeConvo && (
              <button className="new-btn" onClick={newChat}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid #222', borderRadius: '7px', padding: '6px 11px', fontSize: '12px', color: '#777', fontFamily: "'Geist', sans-serif", cursor: 'pointer', transition: 'background .15s' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New
              </button>
            )}
          </header>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {!activeConvo || activeConvo.messages.length === 0 ? (

              /* ── EMPTY STATE — perfectly centered ── */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: '400', color: '#fff', marginBottom: '8px', letterSpacing: '-.3px' }}>How can I help you?</h2>
                <p style={{ fontSize: '13.5px', color: '#555', maxWidth: '280px', lineHeight: 1.65, marginBottom: '32px' }}>
                  Ask me anything. Conversations are saved for {EXPIRY_DAYS} days.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', width: '100%', maxWidth: '460px' }}>
                  {suggestions.map(s => (
                    <button key={s} className="suggest" onClick={() => send(s)}
                      style={{ textAlign: 'left', padding: '13px 15px', background: '#111', border: '1px solid #222', borderRadius: '10px', fontSize: '12.5px', color: '#888', lineHeight: 1.5, fontFamily: "'Geist', sans-serif", cursor: 'pointer', transition: 'background .15s, border-color .15s' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

            ) : (

              /* ── MESSAGES — centered column ── */
              <div style={{ flex: 1, padding: '32px 20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '100%', maxWidth: '680px' }}>
                  {activeConvo.messages.map((msg, i) => (
                    <div key={msg.id} className="msg-in" style={{ marginBottom: '20px', animationDelay: `${Math.min(i * .03, .2)}s` }}>
                      {msg.role === 'user' ? (
                        /* User bubble — right aligned */
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <div style={{ maxWidth: '70%' }}>
                            <div style={{ background: '#fff', color: '#0a0a0a', padding: '11px 16px', borderRadius: '18px 18px 4px 18px', fontSize: '14px', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: '400' }}>
                              {msg.content}
                            </div>
                            <p style={{ fontSize: '10px', color: '#383838', marginTop: '5px', textAlign: 'right' }}>{timeLabel(msg.ts)}</p>
                          </div>
                        </div>
                      ) : (
                        /* AI bubble — left aligned */
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: '#1a1a1a', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                            </svg>
                          </div>
                          <div style={{ maxWidth: 'calc(100% - 38px)' }}>
                            <div style={{ background: '#111', border: '1px solid #1e1e1e', color: '#d8d8d8', padding: '12px 16px', borderRadius: '4px 18px 18px 18px', fontSize: '14px', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {msg.content}
                            </div>
                            <p style={{ fontSize: '10px', color: '#383838', marginTop: '5px' }}>{timeLabel(msg.ts)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Typing */}
                  {loading && (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: '#1a1a1a', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                      </div>
                      <div style={{ background: '#111', border: '1px solid #1e1e1e', padding: '14px 18px', borderRadius: '4px 18px 18px 18px', display: 'flex', gap: '5px', alignItems: 'center' }}>
                        {[0,1,2].map(i => <span key={i} className="dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#444', display: 'block' }} />)}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div style={{ background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: '10px', padding: '10px 16px', fontSize: '12.5px', color: '#cc5555', marginBottom: '16px', textAlign: 'center' }}>
                      ⚠ {error}
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              </div>
            )}
          </div>

          {/* ── INPUT BAR ── */}
          <div style={{ padding: '10px 20px 22px', background: '#0a0a0a', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '680px' }}>
              <div className="input-box" style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', background: '#111', border: '1px solid #222', borderRadius: '14px', padding: '10px 12px 10px 16px', transition: 'border-color .2s' }}>
                <textarea ref={textareaRef} rows={1} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Send a message…"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', color: '#e0e0e0', lineHeight: 1.6, minHeight: '24px', maxHeight: '160px', fontFamily: "'Geist', sans-serif" }}
                />
                <button onClick={() => send()} disabled={!input.trim() || loading} className="send-btn"
                  style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'background .15s' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
              <p style={{ textAlign: 'center', fontSize: '10.5px', color: '#333', marginTop: '8px' }}>Enter to send · Shift + Enter for new line</p>
            </div>
          </div>

        </main>
      </div>
    </>
  )
}