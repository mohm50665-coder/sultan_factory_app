import React, { useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuthStore'
import { Menu, X } from 'lucide-react'

export default function AdminPanel() {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const adminMenuItems = [
    { label: 'إدارة المستخدمين', path: '/admin/users' },
    { label: 'صلاحيات الأدوات', path: '/admin/tools-permissions' },
    { label: 'الأهداف والمؤشرات', path: '/admin/goals-kpis' },
    { label: 'التقارير', path: '/admin/reports' },
    { label: 'الإعدادات', path: '/admin/settings' },
  ]

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-4 flex items-center justify-between">
          <h1 className={`font-bold ${sidebarOpen ? 'text-lg' : 'text-xs'}`}>لوحة التحكم</h1>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-4">
          {adminMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-4 py-2 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-800 text-gray-300'
              } ${!sidebarOpen && 'text-center'}`}
            >
              {sidebarOpen ? item.label : item.label.charAt(0)}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={logout}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
          >
            {sidebarOpen ? 'تسجيل الخروج' : 'خروج'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white shadow px-6 py-4">
          <h2 className="text-2xl font-bold text-gray-900">لوحة تحكم الأدمن</h2>
          <p className="text-gray-600">مرحباً، {user?.name}</p>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/users" element={<UsersManagement />} />
            <Route path="/tools-permissions" element={<ToolsPermissions />} />
            <Route path="/goals-kpis" element={<GoalsKPIs />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/" element={<DashboardOverview />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function DashboardOverview() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">نظرة عامة على لوحة التحكم</h3>
      <p className="text-gray-600">اختر أحد الخيارات من القائمة الجانبية للبدء</p>
    </div>
  )
}

function UsersManagement() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">إدارة المستخدمين</h3>
      <p className="text-gray-600">قيد التطوير...</p>
    </div>
  )
}

function ToolsPermissions() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">صلاحيات الأدوات</h3>
      <p className="text-gray-600">قيد التطوير...</p>
    </div>
  )
}

function GoalsKPIs() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">الأهداف والمؤشرات</h3>
      <p className="text-gray-600">قيد التطوير...</p>
    </div>
  )
}

function Reports() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">التقارير</h3>
      <p className="text-gray-600">قيد التطوير...</p>
    </div>
  )
}

function Settings() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">الإعدادات</h3>
      <p className="text-gray-600">قيد التطوير...</p>
    </div>
  )
}
