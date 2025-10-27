import { useState, useEffect } from 'react';
import axios from 'axios';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  Wifi, UserCheck, UserX, AlertTriangle, RefreshCw, Shield, 
  Activity, TrendingUp, Clock, Bell, Eye, Edit, Trash2, Ban, Check,
  Play, Square, Settings, Zap, Gauge  // Added Gauge icon
} from 'lucide-react';

interface Device {
  id: number;
  mac: string;
  ip: string;
  hostname: string;
  role: string;
  status: string;
  last_seen: string;
}

interface Stats {
  total: number;
  active: number;
  blocked: number;
  kicked: number;
}

interface SnortStats {
  total_rules: number;
  enabled_rules: number;
  custom_rules: number;
  total_alerts: number;
  unacknowledged_alerts: number;
  alerts_today: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  low_alerts: number;
}

interface SnortStatus {
  running: boolean;
  mode: string;
  interface: string | null;
  version: string | null;
}

interface RecentAlert {
  id: number;
  timestamp: string;
  msg: string;
  severity: string;
  source_ip: string;
  dest_ip: string;
  protocol: string;
  acknowledged: boolean;
}

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, blocked: 0, kicked: 0 });
  const [snortStats, setSnortStats] = useState<SnortStats | null>(null);
  const [snortStatus, setSnortStatus] = useState<SnortStatus | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'devices' | 'security' | 'snort' | 'activity'>('devices');
  const [snortLoading, setSnortLoading] = useState(false);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (lastMessage) {
      console.log('Received WebSocket message:', lastMessage);
      if (lastMessage.type === 'scan_complete' || lastMessage.type === 'device_updated') {
        fetchDevices();
      }
      if (lastMessage.type === 'snort_alert' || lastMessage.type === 'snort_update') {
        fetchSnortData();
      }
    }
  }, [lastMessage]);

  const fetchAllData = () => {
    fetchDevices();
    fetchSnortData();
  };

  const fetchDevices = async () => {
    try {
      const response = await axios.get('/api/devices/');
      const devicesData = response.data;
      setDevices(devicesData);
      
      const total = devicesData.length;
      const active = devicesData.filter((d: Device) => d.status === 'active').length;
      const blocked = devicesData.filter((d: Device) => d.status === 'blocked').length;
      const kicked = devicesData.filter((d: Device) => d.status === 'kicked').length;
      
      setStats({ total, active, blocked, kicked });
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const fetchSnortData = async () => {
    try {
      const statusResponse = await axios.get('/api/snort/status');
      setSnortStatus(statusResponse.data);

      const statsResponse = await axios.get('/api/snort/stats');
      setSnortStats(statsResponse.data);

      const alertsResponse = await axios.get('/api/snort/alerts', {
        params: { limit: 20, acknowledged: false }
      });
      setRecentAlerts(alertsResponse.data);
    } catch (error) {
      console.error('Failed to fetch Snort data:', error);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await axios.post('/api/devices/scan');
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setTimeout(() => setScanning(false), 2000);
    }
  };

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await axios.patch(`/api/snort/alerts/${alertId}/acknowledge`);
      fetchSnortData();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleBlockDevice = async (deviceId: number) => {
    if (!confirm('Block this device?')) return;
    try {
      await axios.post(`/api/devices/${deviceId}/block`);
      fetchDevices();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleUnblockDevice = async (deviceId: number) => {
    try {
      await axios.post(`/api/devices/${deviceId}/unblock`);
      fetchDevices();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleStartSnort = async () => {
    setSnortLoading(true);
    try {
      await axios.post('/api/snort/control/start');
      alert('Snort started successfully');
      fetchSnortData();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setSnortLoading(false);
    }
  };

  const handleStopSnort = async () => {
    setSnortLoading(true);
    try {
      await axios.post('/api/snort/control/stop');
      alert('Snort stopped successfully');
      fetchSnortData();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setSnortLoading(false);
    }
  };

  const handleRestartSnort = async () => {
    setSnortLoading(true);
    try {
      await axios.post('/api/snort/control/restart');
      alert('Snort restarted successfully');
      fetchSnortData();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setSnortLoading(false);
    }
  };

  const handleReloadRules = async () => {
    try {
      await axios.post('/api/snort/control/reload-rules');
      alert('Rules reloaded successfully');
      fetchSnortData();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Wifi}
          label="Total Devices"
          value={stats.total}
          color="bg-accent"
        />
        <StatCard
          icon={UserCheck}
          label="Active Devices"
          value={stats.active}
          color="bg-green-500"
        />
        <StatCard
          icon={Shield}
          label="Security Alerts"
          value={snortStats?.unacknowledged_alerts || 0}
          color="bg-red-500"
        />
        <StatCard
          icon={Activity}
          label="Alerts Today"
          value={snortStats?.alerts_today || 0}
          color="bg-purple-500"
        />
      </div>

      {/* Snort Status Banner */}
      {snortStatus && (
        <div className={`rounded-xl shadow-sm border p-6 ${
          snortStatus.running 
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
            : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white bg-opacity-20 rounded-xl backdrop-blur-sm">
                <Shield size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Snort IDS/IPS</h3>
                <p className="text-white text-opacity-90">
                  {snortStatus.running 
                    ? `Running in ${snortStatus.mode.toUpperCase()} mode on ${snortStatus.interface || 'N/A'}`
                    : 'Not Running - Start Snort to enable intrusion detection'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${snortStatus.running ? 'bg-white animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-lg font-semibold">
                {snortStatus.running ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions & Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Quick Actions</h3>
              <p className="text-sm text-gray-600">Manage your network and security</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleScan}
                disabled={scanning}
                className="flex items-center space-x-2 bg-accent text-white px-6 py-3 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={20} className={scanning ? 'animate-spin' : ''} />
                <span>{scanning ? 'Scanning...' : 'Scan Network'}</span>
              </button>
              <button
                onClick={fetchAllData}
                className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <RefreshCw size={20} />
                <span>Refresh All</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Navigation Links */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <a
              href="/users"
              className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl transition-all border border-purple-200 group"
            >
              <div className="p-3 bg-purple-500 rounded-xl group-hover:scale-110 transition-transform">
                <UserCheck size={24} className="text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Users & Devices</h4>
                <p className="text-xs text-gray-600">Manage network users</p>
              </div>
            </a>

            <a
              href="/network-control"
              className="flex items-center space-x-4 p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 rounded-xl transition-all border border-indigo-200 group"
            >
              <div className="p-3 bg-indigo-500 rounded-xl group-hover:scale-110 transition-transform">
                <Gauge size={24} className="text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Network Control</h4>
                <p className="text-xs text-gray-600">Bandwidth management</p>
              </div>
            </a>

            <a
              href="/snort"
              className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl transition-all border border-blue-200 group"
            >
              <div className="p-3 bg-blue-500 rounded-xl group-hover:scale-110 transition-transform">
                <Shield size={24} className="text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Snort IDS/IPS</h4>
                <p className="text-xs text-gray-600">Advanced security controls</p>
              </div>
            </a>

            <a
              href="/alerts"
              className="flex items-center space-x-4 p-4 bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-xl transition-all border border-orange-200 group"
            >
              <div className="p-3 bg-orange-500 rounded-xl group-hover:scale-110 transition-transform">
                <Bell size={24} className="text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Alerts & Logs</h4>
                <p className="text-xs text-gray-600">View system alerts</p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            {(['devices', 'security', 'snort', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'devices' && <><Wifi className="inline mr-2" size={16} />Network Devices</>}
                {tab === 'security' && <><Shield className="inline mr-2" size={16} />Security Alerts</>}
                {tab === 'snort' && <><Settings className="inline mr-2" size={16} />Snort Control</>}
                {tab === 'activity' && <><Activity className="inline mr-2" size={16} />Activity Log</>}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Devices Tab */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-800">All Network Devices</h4>
                <span className="text-sm text-gray-600">
                  {devices.length} device{devices.length !== 1 ? 's' : ''} found
                </span>
              </div>

              {devices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hostname</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MAC Address</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Seen</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {devices.map((device) => (
                        <tr key={device.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className={`w-2 h-2 rounded-full ${
                              device.status === 'active' ? 'bg-green-500 animate-pulse' :
                              device.status === 'blocked' ? 'bg-red-500' :
                              'bg-orange-500'
                            }`} />
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-800 font-medium">{device.hostname}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono">{device.ip}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono">{device.mac}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              device.role === 'Admin' ? 'bg-purple-100 text-purple-800' :
                              device.role === 'Volunteer' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {device.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatTimestamp(device.last_seen)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              {device.status === 'blocked' ? (
                                <button
                                  onClick={() => handleUnblockDevice(device.id)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Unblock"
                                >
                                  <Check size={16} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBlockDevice(device.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Block"
                                >
                                  <Ban size={16} />
                                </button>
                              )}
                              <button
                                className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                                title="View Details"
                              >
                                <Eye size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Wifi size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Devices Found</h3>
                  <p className="text-gray-600 mb-4">Scan your network to discover devices</p>
                  <button
                    onClick={handleScan}
                    className="bg-accent text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Scan Network
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-800">Recent Security Alerts</h4>
                <a
                  href="/snort"
                  className="text-sm text-accent hover:text-blue-700 font-medium"
                >
                  View Full Snort Dashboard →
                </a>
              </div>

              {/* Severity Stats */}
              {snortStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-700">Critical</span>
                      <span className="text-2xl font-bold text-red-800">{snortStats.critical_alerts}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-orange-700">High</span>
                      <span className="text-2xl font-bold text-orange-800">{snortStats.high_alerts}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-yellow-700">Medium</span>
                      <span className="text-2xl font-bold text-yellow-800">{snortStats.medium_alerts}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-700">Low</span>
                      <span className="text-2xl font-bold text-blue-800">{snortStats.low_alerts}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Alerts List */}
              {recentAlerts.length > 0 ? (
                <div className="space-y-3">
                  {recentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 border rounded-xl ${getSeverityColor(alert.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              alert.severity === 'critical' ? 'bg-red-200 text-red-900' :
                              alert.severity === 'high' ? 'bg-orange-200 text-orange-900' :
                              alert.severity === 'medium' ? 'bg-yellow-200 text-yellow-900' :
                              'bg-blue-200 text-blue-900'
                            }`}>
                              {alert.severity.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-600 flex items-center">
                              <Clock size={12} className="mr-1" />
                              {formatTimestamp(alert.timestamp)}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 mb-2">{alert.msg}</p>
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="font-mono bg-white bg-opacity-50 px-2 py-1 rounded text-xs">
                              {alert.source_ip}
                            </span>
                            <span className="text-gray-500">→</span>
                            <span className="font-mono bg-white bg-opacity-50 px-2 py-1 rounded text-xs">
                              {alert.dest_ip}
                            </span>
                            <span className="px-2 py-1 bg-white bg-opacity-50 rounded text-xs font-medium">
                              {alert.protocol.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        {!alert.acknowledged && (
                          <button
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            className="ml-4 px-3 py-1 bg-white text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Shield size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Security Alerts</h3>
                  <p className="text-gray-600">
                    {snortStatus?.running 
                      ? 'Your network is secure. No threats detected.' 
                      : 'Start Snort to begin monitoring for security threats.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Snort Control Tab */}
          {activeTab === 'snort' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-800">Snort IDS/IPS Control Panel</h4>
                <button
                  onClick={fetchSnortData}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={16} className="text-gray-600" />
                </button>
              </div>

              {/* Snort Status Card */}
              <div className={`p-6 rounded-xl ${
                snortStatus?.running 
                  ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                  : 'bg-gradient-to-br from-gray-500 to-gray-600'
              } text-white`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-white bg-opacity-20 rounded-xl backdrop-blur-sm">
                      <Shield size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">
                        {snortStatus?.running ? 'Active' : 'Inactive'}
                      </h3>
                      <p className="text-white text-opacity-90">
                        {snortStatus?.running 
                          ? `Running in ${snortStatus.mode.toUpperCase()} mode`
                          : 'Snort is not running'
                        }
                      </p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full ${
                    snortStatus?.running ? 'bg-white animate-pulse' : 'bg-gray-300'
                  }`} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white bg-opacity-10 rounded-lg p-3 backdrop-blur-sm">
                    <p className="text-xs text-white text-opacity-80">Version</p>
                    <p className="text-lg font-semibold">{snortStatus?.version || 'N/A'}</p>
                  </div>
                  <div className="bg-white bg-opacity-10 rounded-lg p-3 backdrop-blur-sm">
                    <p className="text-xs text-white text-opacity-80">Mode</p>
                    <p className="text-lg font-semibold">{snortStatus?.mode.toUpperCase() || 'N/A'}</p>
                  </div>
                  <div className="bg-white bg-opacity-10 rounded-lg p-3 backdrop-blur-sm">
                    <p className="text-xs text-white text-opacity-80">Interface</p>
                    <p className="text-lg font-semibold">{snortStatus?.interface || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h5 className="font-semibold text-gray-800 mb-4">Service Controls</h5>
                <div className="flex flex-wrap gap-3">
                  {!snortStatus?.running ? (
                    <button
                      onClick={handleStartSnort}
                      disabled={snortLoading}
                      className="flex items-center space-x-2 bg-green-500 text-white px-6 py-3 rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      <Play size={20} />
                      <span>{snortLoading ? 'Starting...' : 'Start Snort'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleStopSnort}
                        disabled={snortLoading}
                        className="flex items-center space-x-2 bg-red-500 text-white px-6 py-3 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        <Square size={20} />
                        <span>{snortLoading ? 'Stopping...' : 'Stop Snort'}</span>
                      </button>
                      <button
                        onClick={handleRestartSnort}
                        disabled={snortLoading}
                        className="flex items-center space-x-2 bg-orange-500 text-white px-6 py-3 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={20} />
                        <span>Restart</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleReloadRules}
                    className="flex items-center space-x-2 bg-accent text-white px-6 py-3 rounded-xl hover:bg-blue-600 transition-colors"
                  >
                    <Zap size={20} />
                    <span>Reload Rules</span>
                  </button>
                </div>
              </div>

              {/* Quick Stats Grid */}
              {snortStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Rules</p>
                        <p className="text-2xl font-bold text-gray-800">{snortStats.total_rules}</p>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Shield size={24} className="text-blue-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Enabled Rules</p>
                        <p className="text-2xl font-bold text-green-600">{snortStats.enabled_rules}</p>
                      </div>
                      <div className="p-3 bg-green-100 rounded-lg">
                        <Check size={24} className="text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Custom Rules</p>
                        <p className="text-2xl font-bold text-purple-600">{snortStats.custom_rules}</p>
                      </div>
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <Edit size={24} className="text-purple-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Alerts</p>
                        <p className="text-2xl font-bold text-orange-600">{snortStats.total_alerts}</p>
                      </div>
                      <div className="p-3 bg-orange-100 rounded-lg">
                        <AlertTriangle size={24} className="text-orange-600" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Alert Severity Breakdown */}
              {snortStats && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h5 className="font-semibold text-gray-800 mb-4">Alert Severity Breakdown</h5>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                        <span className="text-sm text-gray-700">Critical Alerts</span>
                      </div>
                      <span className="text-lg font-bold text-red-600">{snortStats.critical_alerts}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((snortStats.critical_alerts / 50) * 100, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-orange-500 rounded-full" />
                        <span className="text-sm text-gray-700">High Alerts</span>
                      </div>
                      <span className="text-lg font-bold text-orange-600">{snortStats.high_alerts}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((snortStats.high_alerts / 50) * 100, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                        <span className="text-sm text-gray-700">Medium Alerts</span>
                      </div>
                      <span className="text-lg font-bold text-yellow-600">{snortStats.medium_alerts}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((snortStats.medium_alerts / 50) * 100, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full" />
                        <span className="text-sm text-gray-700">Low Alerts</span>
                      </div>
                      <span className="text-lg font-bold text-blue-600">{snortStats.low_alerts}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((snortStats.low_alerts / 50) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h5 className="font-semibold text-gray-800 mb-4">Rule Coverage</h5>
                  <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32">
                      <svg className="w-full h-full" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#E5E7EB"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="3"
                          strokeDasharray={`${
                            snortStats 
                              ? (snortStats.enabled_rules / snortStats.total_rules) * 100 
                              : 0
                          }, 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-800">
                          {snortStats && snortStats.total_rules > 0
                            ? Math.round((snortStats.enabled_rules / snortStats.total_rules) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600 mt-4">
                    {snortStats?.enabled_rules || 0} of {snortStats?.total_rules || 0} rules enabled
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h5 className="font-semibold text-gray-800 mb-4">Today's Activity</h5>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm text-purple-700">Alerts Today</span>
                      <span className="text-2xl font-bold text-purple-600">
                        {snortStats?.alerts_today || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <span className="text-sm text-red-700">Unacknowledged</span>
                      <span className="text-2xl font-bold text-red-600">
                        {snortStats?.unacknowledged_alerts || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm text-blue-700">Total Processed</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {snortStats?.total_alerts || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Link to Full Snort Page */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-1">Need More Control?</h5>
                    <p className="text-sm text-gray-600">
                      Access the full Snort dashboard for advanced rule management and detailed alert analysis.
                    </p>
                  </div>
                  <a
                    href="/snort"
                    className="flex items-center space-x-2 bg-accent text-white px-6 py-3 rounded-xl hover:bg-blue-600 transition-colors"
                  >
                    <Shield size={20} />
                    <span>Open Snort Dashboard</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 mb-4">Network Activity Summary</h4>

              {/* Activity Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white">
                  <div className="flex items-center justify-between mb-4">
                    <Activity size={32} />
                    <TrendingUp size={24} />
                  </div>
                  <h5 className="text-sm text-white text-opacity-80 mb-1">Active Devices</h5>
                  <p className="text-3xl font-bold">{stats.active}</p>
                  <p className="text-xs text-white text-opacity-70 mt-2">
                    {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total devices
                  </p>
                </div>

                <div className="p-6 bg-gradient-to-br from-green-500 to-green-600 rounded-xl text-white">
                  <div className="flex items-center justify-between mb-4">
                    <Shield size={32} />
                    <Check size={24} />
                  </div>
                  <h5 className="text-sm text-white text-opacity-80 mb-1">Rules Active</h5>
                  <p className="text-3xl font-bold">{snortStats?.enabled_rules || 0}</p>
                  <p className="text-xs text-white text-opacity-70 mt-2">
                    {snortStats ? Math.round((snortStats.enabled_rules / snortStats.total_rules) * 100) : 0}% coverage
                  </p>
                </div>

                <div className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl text-white">
                  <div className="flex items-center justify-between mb-4">
                    <Bell size={32} />
                    <AlertTriangle size={24} />
                  </div>
                  <h5 className="text-sm text-white text-opacity-80 mb-1">Alerts Today</h5>
                  <p className="text-3xl font-bold">{snortStats?.alerts_today || 0}</p>
                  <p className="text-xs text-white text-opacity-70 mt-2">
                    {snortStats?.unacknowledged_alerts || 0} unacknowledged
                  </p>
                </div>
              </div>

              {/* Recent Activity Timeline */}
              <div className="mt-6">
                <h5 className="font-semibold text-gray-800 mb-4">Recent Activity</h5>
                <div className="space-y-3">
                  {devices.slice(0, 5).map((device) => (
                    <div key={device.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className={`w-3 h-3 rounded-full ${
                        device.status === 'active' ? 'bg-green-500' :
                        device.status === 'blocked' ? 'bg-red-500' :
                        'bg-orange-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{device.hostname}</p>
                        <p className="text-xs text-gray-600">{device.ip} • Last seen {formatTimestamp(device.last_seen)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        device.status === 'active' ? 'bg-green-100 text-green-800' :
                        device.status === 'blocked' ? 'bg-red-100 text-red-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {device.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Component
const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
      </div>
      <div className={`p-4 rounded-xl ${color}`}>
        <Icon size={28} className="text-white" />
      </div>
    </div>
  </div>
);