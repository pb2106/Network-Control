import { useState, useEffect } from 'react';
import axios from 'axios';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  Shield, Play, Square, RefreshCw, Settings, CheckCircle, XCircle, 
  AlertTriangle, Plus, Edit, Trash2, Eye, Download, Upload 
} from 'lucide-react';

interface SnortStatus {
  running: boolean;
  mode: string;
  interface: string | null;
  version: string | null;
  uptime: string | null;
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

interface SnortAlert {
  id: number;
  timestamp: string;
  sid: number;
  msg: string;
  classification: string;
  priority: number;
  protocol: string;
  source_ip: string;
  source_port: number | null;
  dest_ip: string;
  dest_port: number | null;
  severity: string;
  acknowledged: boolean;
}

interface SnortRule {
  id: number;
  sid: number;
  action: string;
  protocol: string;
  source_ip: string;
  source_port: string;
  direction: string;
  dest_ip: string;
  dest_port: string;
  msg: string;
  priority: number;
  enabled: boolean;
  custom: boolean;
  raw_rule: string;
}

export default function Snort() {
  const [status, setStatus] = useState<SnortStatus | null>(null);
  const [stats, setStats] = useState<SnortStats | null>(null);
  const [alerts, setAlerts] = useState<SnortAlert[]>([]);
  const [rules, setRules] = useState<SnortRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'rules'>('overview');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    fetchStatus();
    fetchStats();
    fetchAlerts();
    fetchRules();
  }, []);

  useEffect(() => {
    if (lastMessage && (lastMessage.type === 'snort_alert' || lastMessage.type === 'snort_update')) {
      fetchAlerts();
      fetchStats();
    }
  }, [lastMessage]);

  const fetchStatus = async () => {
    try {
      const response = await axios.get('/api/snort/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch Snort status:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/snort/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch Snort stats:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await axios.get('/api/snort/alerts', {
        params: { limit: 50 }
      });
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  const fetchRules = async () => {
    try {
      const response = await axios.get('/api/snort/rules', {
        params: { limit: 100 }
      });
      setRules(response.data);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      await axios.post('/api/snort/control/start');
      alert('Snort started successfully');
      fetchStatus();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await axios.post('/api/snort/control/stop');
      alert('Snort stopped successfully');
      fetchStatus();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    setLoading(true);
    try {
      await axios.post('/api/snort/control/restart');
      alert('Snort restarted successfully');
      fetchStatus();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReloadRules = async () => {
    try {
      await axios.post('/api/snort/control/reload-rules');
      alert('Rules reloaded successfully');
      fetchRules();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await axios.patch(`/api/snort/alerts/${alertId}/acknowledge`);
      fetchAlerts();
      fetchStats();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleClearAlerts = async () => {
    if (!confirm('Clear all acknowledged alerts?')) return;
    
    try {
      await axios.post('/api/snort/alerts/clear', null, {
        params: { acknowledged_only: true }
      });
      alert('Acknowledged alerts cleared');
      fetchAlerts();
      fetchStats();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleToggleRule = async (ruleId: number, currentEnabled: boolean) => {
    try {
      await axios.patch(`/api/snort/rules/${ruleId}`, {
        enabled: !currentEnabled
      });
      fetchRules();
      fetchStats();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDeleteRule = async (ruleId: number, isCustom: boolean) => {
    if (!isCustom) {
      alert('Cannot delete built-in rules');
      return;
    }
    
    if (!confirm('Delete this rule?')) return;
    
    try {
      await axios.delete(`/api/snort/rules/${ruleId}`);
      alert('Rule deleted');
      fetchRules();
      fetchStats();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
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

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-xl ${status?.running ? 'bg-green-500' : 'bg-gray-500'}`}>
                <Shield className="text-white" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Snort IDS/IPS</h3>
                <p className="text-sm text-gray-600">
                  {status?.running ? `Running in ${status.mode.toUpperCase()} mode` : 'Stopped'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchStatus}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw size={20} className="text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <span className="text-gray-600">Status</span>
              <div className="flex items-center space-x-2">
                {status?.running ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-semibold text-green-600">Running</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="font-semibold text-gray-600">Stopped</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <span className="text-gray-600">Version</span>
              <span className="font-semibold text-gray-800">
                {status?.version || 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <span className="text-gray-600">Interface</span>
              <span className="font-semibold text-gray-800">
                {status?.interface || 'N/A'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
            {!status?.running ? (
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex items-center space-x-2 bg-green-500 text-white px-6 py-3 rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                <Play size={20} />
                <span>{loading ? 'Starting...' : 'Start Snort'}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleStop}
                  disabled={loading}
                  className="flex items-center space-x-2 bg-red-500 text-white px-6 py-3 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <Square size={20} />
                  <span>{loading ? 'Stopping...' : 'Stop Snort'}</span>
                </button>
                <button
                  onClick={handleRestart}
                  disabled={loading}
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
              <Settings size={20} />
              <span>Reload Rules</span>
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Rules"
            value={stats.total_rules}
            icon={Shield}
            color="bg-blue-500"
          />
          <StatCard
            label="Enabled Rules"
            value={stats.enabled_rules}
            icon={CheckCircle}
            color="bg-green-500"
          />
          <StatCard
            label="Total Alerts"
            value={stats.total_alerts}
            icon={AlertTriangle}
            color="bg-orange-500"
          />
          <StatCard
            label="Unacknowledged"
            value={stats.unacknowledged_alerts}
            icon={AlertTriangle}
            color="bg-red-500"
          />
          <StatCard
            label="Alerts Today"
            value={stats.alerts_today}
            icon={AlertTriangle}
            color="bg-purple-500"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            {(['overview', 'alerts', 'rules'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Alerts by Severity</h4>
                    <div className="space-y-2">
                      <SeverityBar label="Critical" count={stats.critical_alerts} color="bg-red-500" />
                      <SeverityBar label="High" count={stats.high_alerts} color="bg-orange-500" />
                      <SeverityBar label="Medium" count={stats.medium_alerts} color="bg-yellow-500" />
                      <SeverityBar label="Low" count={stats.low_alerts} color="bg-blue-500" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Rule Statistics</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-600">Total Rules</span>
                        <span className="font-semibold text-gray-800">{stats.total_rules}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <span className="text-green-700">Enabled Rules</span>
                        <span className="font-semibold text-green-800">{stats.enabled_rules}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                        <span className="text-blue-700">Custom Rules</span>
                        <span className="font-semibold text-blue-800">{stats.custom_rules}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-800">Recent Alerts</h4>
                <button
                  onClick={handleClearAlerts}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear Acknowledged
                </button>
              </div>

              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.map((alert) => (
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
                            <span className="text-xs text-gray-600">
                              {formatTimestamp(alert.timestamp)}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 mb-2">{alert.msg}</p>
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="font-mono bg-white bg-opacity-50 px-2 py-1 rounded">
                              {alert.source_ip}:{alert.source_port || 'any'}
                            </span>
                            <span className="text-gray-500">→</span>
                            <span className="font-mono bg-white bg-opacity-50 px-2 py-1 rounded">
                              {alert.dest_ip}:{alert.dest_port || 'any'}
                            </span>
                            <span className="text-gray-600">
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
                  <p className="text-gray-600">No alerts recorded</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-800">Snort Rules</h4>
                <button
                  onClick={() => setShowRuleModal(true)}
                  className="flex items-center space-x-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm"
                >
                  <Plus size={16} />
                  <span>Add Rule</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protocol</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-gray-800">{rule.sid}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{rule.msg}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{rule.protocol.toUpperCase()}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{rule.priority}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            rule.custom ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {rule.custom ? 'Custom' : 'Built-in'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleRule(rule.id, rule.enabled)}
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            {rule.custom && (
                              <button
                                onClick={() => handleDeleteRule(rule.id, rule.custom)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
const StatCard = ({ label, value, icon: Icon, color }: any) => (
  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
      </div>
      <div className={`p-4 rounded-xl ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  </div>
);

const SeverityBar = ({ label, count, color }: any) => (
  <div>
    <div className="flex justify-between text-sm mb-1">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-800">{count}</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className={`${color} h-2 rounded-full transition-all duration-300`}
        style={{ width: `${Math.min((count / 100) * 100, 100)}%` }}
      />
    </div>
  </div>
);