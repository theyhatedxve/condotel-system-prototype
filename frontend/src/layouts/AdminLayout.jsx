import {
  Outlet,
} from 'react-router-dom';

import Sidebar from
  '../layouts/Sidebar';

import Topbar from
  '../layouts/Topbar';

import './layout.css';

export default function AdminLayout() {
  return (
    <div className="admin-layout">
      <Sidebar />

      <div className="admin-main">
        <Topbar />

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
