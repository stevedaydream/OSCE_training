import { useEffect, useState } from 'react';
import { Stethoscope, AlertTriangle } from 'lucide-react';
import { supabase, configError } from './lib/supabase';
import AuthGate from './components/AuthGate';
import DoorView from './components/DoorView';
import CoachView from './components/CoachView';
import PracticeTab from './components/PracticeTab';
import StationsTab from './components/StationsTab';
import SessionsTab from './components/SessionsTab';
import BuildTab from './components/BuildTab';
import DrillTab from './components/DrillTab';
import ThemeToggle from './components/ThemeToggle';

const TABS = [
  { id: 'practice', label: '演練' },
  { id: 'drill', label: '速練' },
  { id: 'stations', label: '題庫' },
  { id: 'build', label: '出題' },
  { id: 'sessions', label: '紀錄' },
];

export default function App() {
  // 這一關要擋在所有分支之前：三種角色都需要 Supabase。
  if (configError) return <ConfigErrorScreen />;

  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get('join');
  const role = params.get('as');

  // 手機門前貼紙端與陪練考官端不需要登入，也不碰資料庫。
  // 它們只靠房間碼加入 Realtime 頻道，接收考生端廣播的狀態。
  if (joinCode && role === 'door') return <DoorView joinCode={joinCode} />;
  if (joinCode && role === 'coach') return <CoachView joinCode={joinCode} />;

  return <HostApp />;
}

function ConfigErrorScreen() {
  return (
    <div className="page page-narrow" style={{ paddingTop: '5rem' }}>
      <div className="card">
        <div className="card-title">
          <AlertTriangle size={20} color="#a55a06" />
          <h2>站台尚未設定完成</h2>
        </div>
        <p className="muted">{configError}</p>
        <div className="notice notice-warn" style={{ marginTop: '1rem' }}>
          到 Vercel 專案的 Settings → Environment Variables 加入這兩個值，
          <strong>然後重新部署一次</strong>。Vite 是在建置當下把變數內嵌進檔案的，
          只加變數而不重建，線上仍會是舊的空值。
        </div>
      </div>
    </div>
  );
}

function HostApp() {
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState('practice');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="empty">載入中…</div>;
  }

  if (!session) return <AuthGate />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <Stethoscope size={22} color="#38bdf8" />
          <div>
            專科護理師甄審口試演練
            <small>依 110 年度甄審口試流程及評分方式公告</small>
          </div>
        </div>

        <div className="topbar-spacer" />

        <nav className="tabs">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="tab"
              aria-current={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <ThemeToggle />

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => supabase.auth.signOut()}
        >
          登出
        </button>
      </header>

      {tab === 'practice' && <PracticeTab />}
      {tab === 'drill' && <DrillTab />}
      {tab === 'stations' && <StationsTab />}
      {tab === 'build' && <BuildTab />}
      {tab === 'sessions' && <SessionsTab />}
    </div>
  );
}
