import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Activity, Database, Users } from 'lucide-react';

interface FirewallStats {
  total_actions: number;
  blocks: number;
  unblocks: number;
  kicks: number;
  success_rate: number;
}

interface AlertStats {
  total: number;
  unread: number;
  by_level: {
    info: number;
    warning: number;
    danger: number;
  };
}

export default function Settings() {
  const [firewallStats, setFirewallStats] = useState<FirewallStats | null>(null);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, []);

  const fetchStats = async () => {
    try {
      const [firewallRes, alertRes] = await Promise.all([
        axios.get('/api/firewall/stats'),
        axios.get('/api/alerts/stats')
      ]);
      setFirewallStats(firewallRes.data);
      setAlertStats(alertRes.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users/');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-accent rounded-xl">
              <Shield className="text-white" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Firewall Statistics</h3>
          </div>
          {firewallStats && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Actions</span>
                <span className="font-semibold text-gray-800">{firewallStats.total_actions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Blocks</span>
                <span className="font-semibold text-red-600">{firewallStats.blocks}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Unblocks</span>
                <span className="font-semibold text-green-600">{firewallStats.unblocks}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Kicks</span>
                <span className="font-semibold text-orange-600">{firewallStats.kicks}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="text-gray-600">Success Rate</span>
                <span className="font-semibold text-accent">
                  {(firewallStats.success_rate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-orange-500 rounded-xl">
              <Activity className="text-white" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Alert Statistics</h3>
          </div>
          {alertStats && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Alerts</span>
                <span className="font-semibold text-gray-800">{alertStats.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Unread</span>
                <span className="font-semibold text-orange-600">{alertStats.unread}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Info</span>
                <span className="font-semibold text-blue-600">{alertStats.by_level.info}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Warning</span>
                <span className="font-semibold text-orange-600">{alertStats.by_level.warning}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Danger</span>
                <span className="font-semibold text-red-600">{alertStats.by_level.danger}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin Users */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-500 rounded-xl">
              <Users className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Admin Users</h3>
              <p className="text-sm text-gray-600">Manage administrator accounts</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-800">{user.username}</p>
                  <p className="text-sm text-gray-600">
                    Role: <span className="font-medium">{user.role}</span>
                  </p>
                  {user.last_login && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last login: {new Date(user.last_login).toLocaleString()}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-green-500 rounded-xl">
            <Database className="text-white" size={24} />
          </div>
          <h3 className="text-lg font-semibold text-gray-800">System Information</h3>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Database</span>
            <span className="font-semibold text-gray-800">SQLite (network.db)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Backend</span>
            <span className="font-semibold text-gray-800">FastAPI + Python</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Frontend</span>
            <span className="font-semibold text-gray-800">React + TypeScript</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Real-time Sync</span>
            <span className="font-semibold text-green-600">WebSocket Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}