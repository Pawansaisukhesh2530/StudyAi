import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} />
      <div className="app-shell__main">
        <Navbar onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
