'use client';
// CollabEditor — Monaco editor wired to a shared Y.Doc via y-websocket.
// Multiple browsers pointing at the same `room` see real-time edits + cursors.
//
// Why dynamic-import: Monaco depends on `window`, so it must NOT be SSR'd.

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { editor } from 'monaco-editor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface Props {
  room:         string;        // unique room ID for this workspace
  language:     string;
  initialCode?: string;
  username:     string;
}

const USER_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

function pickColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return USER_COLORS[hash % USER_COLORS.length];
}

export default function CollabEditor({ room, language, initialCode = '', username }: Props) {
  const [peers, setPeers] = useState<string[]>([]);
  const ydocRef     = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef  = useRef<MonacoBinding | null>(null);

  // Set up Yjs doc and websocket provider once
  useEffect(() => {
    const ydoc     = new Y.Doc();
    const wsUrl    = process.env.NEXT_PUBLIC_COLLAB_WS_URL || 'ws://localhost:1234';
    const provider = new WebsocketProvider(wsUrl, room, ydoc);

    provider.awareness.setLocalStateField('user', {
      name: username,
      color: pickColor(username),
    });

    const onAwareness = () => {
      const states = Array.from(provider.awareness.getStates().values()) as Array<{ user?: { name: string } }>;
      setPeers(states.map((s) => s.user?.name).filter((n): n is string => Boolean(n)));
    };
    provider.awareness.on('change', onAwareness);

    ydocRef.current     = ydoc;
    providerRef.current = provider;

    return () => {
      provider.awareness.off('change', onAwareness);
      provider.destroy();
      ydoc.destroy();
    };
  }, [room, username]);

  const onMount = (instance: editor.IStandaloneCodeEditor) => {
    const ydoc     = ydocRef.current!;
    const provider = providerRef.current!;
    const ytext    = ydoc.getText('monaco');

    // Seed the doc with initial code only if it's currently empty
    if (ytext.length === 0 && initialCode) {
      ytext.insert(0, initialCode);
    }

    bindingRef.current = new MonacoBinding(
      ytext,
      instance.getModel()!,
      new Set([instance]),
      provider.awareness,
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 text-xs flex items-center gap-3 border-b border-slate-800 bg-slate-900">
        <span className="text-slate-400">room: <span className="font-mono">{room}</span></span>
        <span className="text-slate-400 ml-auto">
          {peers.length} editor{peers.length !== 1 ? 's' : ''} online
        </span>
        {peers.slice(0, 6).map((p) => (
          <span key={p} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: pickColor(p), color: 'white' }}>
            {p}
          </span>
        ))}
      </div>

      <div className="flex-1">
        <MonacoEditor
          height="100%"
          theme="vs-dark"
          language={language}
          onMount={onMount}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 4,
          }}
        />
      </div>
    </div>
  );
}
