import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuthStore'
import { LogOut, Settings, BarChart3, Users } from 'lucide-react'

export default function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const menuItems = [
    { icon: '📊', label: 'لوحة المعلومات', path: '/dashboard' },
    { icon: '🏭', label: 'مراحل الإنتاج', path: '/production' },
    { icon: '🔧', label: 'الصيانة', path: '/maintenance' },
    { icon: '💰', label: 'المالية', path: '/financial' },
    { icon: '📦', label: 'المستودع', path: '/collection' },
    { icon: '📋', label: 'الإجراءات الإدارية', path: '/administrative-actions' },
    { icon: '👥', label: 'إدارة المستخدمين', path: '/users-management' },
    { icon: '🎯', label: 'الأهداف والمؤشرات', path: '/admin-goals-kpis' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">مصنع السلطان</h1>
            <p className="text-gray-600">مرحباً، {user?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                لوحة التحكم
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {menuItems.map((item) => (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6 text-center"
            >
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900">{item.label}</h3>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
