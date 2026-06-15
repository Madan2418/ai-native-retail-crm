'use client';

import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { aiApi, segmentsApi, campaignsApi } from '@/lib/api';
import { Sparkles, Send, Loader2, Bot, User, CheckCircle2, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

type Message = { role: 'user' | 'ai'; content: string };

const EXAMPLE_PROMPTS = [
  "Reach customers who spent over ₹5000 but haven't ordered in 60 days with a win-back offer",
  "Send a loyalty reward to our Champions segment via WhatsApp",
  "Target At Risk customers in Mumbai and Delhi with a flash sale",
  "Re-engage hibernating customers with a comeback discount",
];

const CHANNEL_STYLES: Record<string, string> = {
  whatsapp: 'bg-green-50 text-green-700',
  sms:      'bg-blue-50 text-blue-700',
  email:    'bg-violet-50 text-violet-700',
  rcs:      'bg-cyan-50 text-cyan-700',
};

export default function AIBuilderPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: "Hello! Describe the campaign you want to run in plain English and I'll build it for you — segment, message template, and channel recommendation included." }
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<any>(null);
  const [saving, setSaving]   = useState(false);
  const [launched, setLaunched] = useState(false);

  function classifyError(msg: string): string {
    if (msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('high demand')) {
      return 'Gemini AI is currently experiencing high demand. This is temporary — please wait a moment and try again.';
    }
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
      return 'API rate limit reached. Please wait a minute before trying again.';
    }
    if (msg.includes('GEMINI_API_KEY') || msg.includes('not configured')) {
      return 'The Gemini API key is not configured on the server. Add GEMINI_API_KEY to backend/.env to enable AI features.';
    }
    if (msg.includes('Network Error') || msg.includes('ECONNREFUSED')) {
      return 'Cannot reach the backend server. Make sure it is running on port 3000.';
    }
    return `Something went wrong: ${msg}`;
  }

  async function send(text?: string) {
    const prompt = text || input.trim();
    if (!prompt || loading) return;
    setInput(''); setResult(null); setLaunched(false);
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setLoading(true);
    try {
      const data = await aiApi.buildCampaign(prompt);
      setResult(data);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `I've built a campaign based on your request.\n\nSegment: ${data.segment?.name}\nChannel: ${(data.channel || '').toUpperCase()}\nMessage: "${(data.message_template || '').slice(0, 100)}..."\n\nReasoning: ${data.reasoning}\n\nReview the details on the right and launch when ready.`,
      }]);
    } catch (err: any) {
      const friendly = classifyError(err.message || '');
      setMessages(prev => [...prev, { role: 'ai', content: friendly, isError: true, retryPrompt: prompt } as any]);
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (!result) return;
    setSaving(true);
    try {
      const seg = await segmentsApi.create({
        name: result.segment.name,
        description: result.segment.description,
        filter_rules: result.segment.filter_rules,
      });
      await campaignsApi.create({
        name: result.segment.name + ' Campaign',
        segment_id: seg.id,
        channel: result.channel,
        message_template: result.message_template,
        launch: true,
      });
      setLaunched(true);
      setMessages(prev => [...prev, { role: 'ai', content: 'Campaign launched successfully. Messages are being personalized and sent. Check the Campaigns tab for live stats.' }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', content: `Launch failed: ${err.message}` }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">AI Campaign Builder</h1>
          </div>
          <p className="text-sm text-slate-500">Describe your campaign in plain English. Gemini builds the segment, message, and channel recommendation.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: 'auto' }}>
          {/* Chat */}
          <div className="lg:col-span-2 card flex flex-col overflow-hidden" style={{ minHeight: '480px' }}>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((msg: any, i) => (
                <div key={i} className={clsx('flex items-start gap-3 animate-slide-up', msg.role === 'user' && 'flex-row-reverse')}>
                  <div className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white',
                    msg.role === 'ai' ? (msg.isError ? 'bg-amber-500' : 'bg-blue-600') : 'bg-slate-700'
                  )}>
                    {msg.role === 'ai' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  </div>
                  <div className={clsx(
                    'max-w-[80%] px-4 py-3 rounded-xl text-sm leading-relaxed',
                    msg.role === 'ai' && !msg.isError && 'bg-slate-50 border border-slate-200 text-slate-700 rounded-tl-none',
                    msg.role === 'ai' && msg.isError  && 'bg-amber-50 border border-amber-200 text-amber-800 rounded-tl-none',
                    msg.role === 'user'                && 'bg-blue-600 text-white rounded-tr-none',
                  )}>
                    {msg.content.split('\n').map((line: string, j: number) => (
                      <p key={j} className={line.startsWith('Segment:') || line.startsWith('Channel:') || line.startsWith('Reasoning:') ? 'font-semibold mt-1 text-slate-900' : 'mt-0.5'}>
                        {line}
                      </p>
                    ))}
                    {msg.isError && msg.retryPrompt && (
                      <button
                        onClick={() => send(msg.retryPrompt)}
                        className="mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-900 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl rounded-tl-none">
                    <div className="flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms'   }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Example prompts */}
            {messages.length === 1 && (
              <div className="px-5 pb-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Example prompts:</p>
                <div className="grid grid-cols-2 gap-2">
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button key={i} onClick={() => send(p)}
                      className="text-left text-xs px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-800 transition-colors leading-relaxed">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-slate-200 p-4">
              <div className="flex gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Describe your campaign goal..."
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 disabled:bg-slate-50"
                />
                <button onClick={() => send()} disabled={!input.trim() || loading}
                  className="w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center transition-colors">
                  {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>
          </div>

          {/* Campaign preview panel */}
          <div>
            {result ? (
              <div className="card p-5 animate-slide-up space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-900">Campaign Ready</span>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Segment</p>
                  <p className="text-sm font-semibold text-slate-900">{result.segment?.name}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Channel</p>
                  <span className={clsx('text-xs font-semibold uppercase px-2 py-0.5 rounded', CHANNEL_STYLES[result.channel] || 'bg-slate-100 text-slate-600')}>
                    {result.channel}
                  </span>
                </div>

                {result.segment?.filter_rules?.conditions?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Filters</p>
                    <div className="space-y-1.5">
                      {result.segment.filter_rules.conditions.map((c: any, i: number) => (
                        <div key={i} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600">
                          <span className="font-medium text-slate-800">{c.field}</span>{' '}
                          {c.op}{' '}
                          <span className="font-medium text-blue-600">{Array.isArray(c.value) ? c.value.join(', ') : c.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Message Template</p>
                  <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                    {result.message_template}
                  </div>
                </div>

                {result.reasoning && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">AI Reasoning</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{result.reasoning}</p>
                  </div>
                )}

                {!launched ? (
                  <button onClick={handleLaunch} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white font-semibold transition-colors disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Create Segment & Launch
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-2.5 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-semibold">Launched successfully</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-8 text-center text-slate-400">
                <Bot className="w-9 h-9 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Your AI-built campaign<br />will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
