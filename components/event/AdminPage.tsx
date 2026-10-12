'use client';
import Link from 'next/link';
import {useCallback, useEffect, useState} from 'react';
import {Eye, EyeOff, RotateCcw} from 'lucide-react';
import {api, postJson, timeLabel} from '@/lib/client';

type Row = {id: string; kind: string; status: string; hidden: boolean; error: string | null; input: string; nickname: string | null; body: string; createdAt: string};

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { try { setToken(sessionStorage.getItem('moons.admin') ?? ''); } catch {} }, []);
  const headers = useCallback(() => ({'x-admin-token': token}), [token]);
  const load = useCallback(async () => {
    if (!token) return;
    try { setRows(await api<Row[]>('/api/admin/entries', {headers: headers()})); setError(''); }
    catch (e) { setError((e as Error).message); setRows(null); }
  }, [token, headers]);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  async function hide(row: Row) {
    await api(`/api/admin/entries/${row.id}`, {...postJson({hidden: !row.hidden}), method: 'PATCH', headers: {...headers(), 'Content-Type': 'application/json'}}).catch(e => setError(e.message));
    load();
  }
  async function retry(row: Row) {
    await api(`/api/entries/${row.id}/retry`, {method: 'POST', headers: headers()}).catch(e => setError(e.message));
    load();
  }

  return <div className="ev ev-admin">
    <header className="ev-bar"><strong>MOONS 운영</strong><Link href="/live" className="ev-back right">큰 화면</Link></header>
    <main className="ad-main">
      <form className="ad-token" onSubmit={e => { e.preventDefault(); try { sessionStorage.setItem('moons.admin', token); } catch {} load(); }}>
        <label htmlFor="ad-token">관리자 토큰</label>
        <input id="ad-token" type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="off"/>
        <button className="ev-primary">열기</button>
      </form>
      {error && <p className="ev-error">{error}</p>}
      {rows && <p className="ev-note">{rows.length}개 · 5초마다 새로고침 · 숨기면 큰 화면에서 바로 사라져요</p>}
      <ul className="ad-list">{rows?.map(r => <li key={r.id} className={r.hidden ? 'hidden' : ''}>
        <div className="ad-meta"><span>{timeLabel(r.createdAt)}</span><span>{r.kind}</span><span>{r.input === 'voice' ? '음성' : '글'}</span><span className={`ad-status ${r.status}`}>{r.status}{r.error ? ` · ${r.error}` : ''}</span>{r.nickname && <span>{r.nickname}</span>}</div>
        <p>{r.body}</p>
        <div className="ad-actions">
          <button className="ev-secondary" onClick={() => hide(r)}>{r.hidden ? <><Eye size={15}/>다시 보이기</> : <><EyeOff size={15}/>숨기기</>}</button>
          {(r.status === 'failed' || r.status === 'saved') && <button className="ev-secondary" onClick={() => retry(r)}><RotateCcw size={15}/>다시 돌리기</button>}
          <Link className="ev-link" href={`/t/${r.id}`}>보기</Link>
        </div>
      </li>)}</ul>
    </main>
  </div>;
}
