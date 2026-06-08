'use client';
import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

/**
 * Interactive shell for a workspace. Connects an xterm.js terminal to the
 * backend `/workspaces/:id/terminal` WebSocket (proxied through Next at /api),
 * which runs a real shell rooted in the workspace directory. Keystrokes are
 * sent as {"i": data}; window resizes as {"r": [rows, cols]}.
 */
export default function Terminal({ workspaceId }: { workspaceId: number }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const term = new XTerm({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      theme: { background: '#020617', foreground: '#e2e8f0', cursor: '#38bdf8' },
      cursorBlink: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    try { fit.fit(); } catch { /* not laid out yet */ }

    // token lives in the persisted auth store
    let token = '';
    try {
      const raw = window.localStorage.getItem('astra-auth');
      token = raw ? (JSON.parse(raw)?.state?.token ?? '') : '';
    } catch { /* ignore */ }

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${window.location.host}/api/workspaces/${workspaceId}/terminal?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      term.writeln('\x1b[90mconnected — shell rooted at your workspace files\x1b[0m');
      ws.send(JSON.stringify({ r: [term.rows, term.cols] }));
    };
    ws.onmessage = (e) => term.write(e.data);
    ws.onclose = () => term.writeln('\r\n\x1b[90m[disconnected]\x1b[0m');
    ws.onerror = () => term.writeln('\r\n\x1b[31m[connection error]\x1b[0m');

    const dataSub = term.onData((d) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ i: d }));
    });

    const onResize = () => {
      try { fit.fit(); } catch { /* ignore */ }
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ r: [term.rows, term.cols] }));
    };
    window.addEventListener('resize', onResize);
    // settle layout, then fit once more
    const t = setTimeout(onResize, 50);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
      dataSub.dispose();
      ws.close();
      term.dispose();
    };
  }, [workspaceId]);

  return <div ref={hostRef} className="h-full w-full bg-slate-950 p-1" />;
}
