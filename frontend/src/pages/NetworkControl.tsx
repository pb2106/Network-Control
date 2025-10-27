import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Wifi, RefreshCw, Gauge, TrendingDown, TrendingUp, 
  Ban, Play, Square, AlertCircle, Check, X, Settings,
  Download, Upload, Activity, Zap
} from 'lucide-react';

interface Device {
  id: number;
  mac: string;
  ip: string;
  hostname: string;
  role: string;
  status: string;
}

interface BandwidthLimit {
  id: string;
  target_ip: string;
  target_mac: string;
  hostname: string | null;
  download_limit: number | null;
  upload_limit: number | null;
  status: string;
  created_at: string;
}

interface EvilLimiterStatus {
  available: boolean;
  path?: string;
  platform?: string;
  active_limits?: number;
  error?: string;
}

export default function NetworkControl() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [limits, setLimits] = useState<BandwidthLimit[]>([]);
  const [status, setStatus] = useState<EvilLimiterStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [downloadLimit, setDownloadLimit] = useState<string>('');
  const [uploadLimit, setUploadLimit] = useState<string>('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    await Promise.all([
      fetchStatus(),
      fetchDevices(),
      fetchActiveLimits()
    ]);
  };

  const fetchStatus = async () => {
    try {
      const response = await axios.get('/api/network-control/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await axios.get('/api/devices/');
      setDevices(response.data);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const fetchActiveLimits = async () => {
    try {
      const response = await axios.get('/api/network-control/limits');
      setLimits(response.data.limits || []);
    } catch (error) {
      console.error('Failed to fetch limits:', error);
    }
  };

  const handleApplyLimit = async () => {
    if (!selectedDevice) return;

    setLoading(true);
    try {
      await axios.post('/api/network-control/limit', {
        target_ip: selectedDevice.ip,
        target_mac: selectedDevice.mac,
        hostname: selectedDevice.hostname,
        download_limit: downloadLimit ? parseInt(downloadLimit) : null,
        upload_limit: uploadLimit ? parseInt(uploadLimit) : null
      });

      alert('Bandwidth limit applied successfully!');
      setShowLimitModal(false);
      setSelectedDevice(null);
      setDownloadLimit('');
      setUploadLimit('');
      await fetchActiveLimits();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLimit = async (targetIp: string) => {
    if (!confirm('Remove bandwidth limit?')) return;

    setLoading(true);
    try {
      await axios.delete(`/api/network-control/limit/${targetIp}`);
      alert('Limit removed successfully!');
      await fetchActiveLimits();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockDevice = async (device: Device) => {
    if (!confirm(`Block all bandwidth for ${device.hostname}?`)) return;

    setLoading(true);
    try {
      await axios.post(`/api/network-control/block/${device.ip}`);
      alert('Device blocked successfully!');
      await fetchActiveLimits();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Remove ALL bandwidth limits?')) return;

    setLoading(true);
    try {
      await axios.delete('/api/network-control/clear-all');
      alert('All limits cleared!');
      await fetchActiveLimits();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openLimitModal = (device: Device) => {
    setSelectedDevice(device);
    
    // Check if device already has limits
    const existingLimit = limits.find(l => l.target_ip === device.ip);
    if (existingLimit) {
      setDownloadLimit(existingLimit.download_limit?.toString() || '');
      setUploadLimit(existingLimit.upload_limit?.toString() || '');
    } else {
      setDownloadLimit('');
      setUploadLimit('');
    }
    
    setShowLimitModal(true);
  };

  const getDeviceLimit = (ip: string) => {
    return limits.find(l => l.target_ip === ip);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Network Control</h1>
            <p className="text-purple-100">
              Manage bandwidth limits and control network traffic with Evil Limiter
            </p>
          </div>
          <div className="p-4 bg-white bg-opacity-20 rounded-xl backdrop-blur-sm">
            <Gauge size={48} />
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {status && (
        <div className={`rounded-xl shadow-sm border p-6 ${
          status.available 
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
            : 'bg-gradient-to-r from-red-500 to-orange-600 text-white'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white bg-opacity-20 rounded-xl backdrop-blur-sm">
                {status.available ? <Check size={32} /> : <AlertCircle size={32} />}
              </div>
              <div>
                <h3 className="text-2xl font-bold">
                  {status.available ? 'Evil Limiter Ready' : 'Evil Limiter Not Available'}
                </h3>
                <p className="text-white text-opacity-90">
                  {status.available 
                    ? `${status.active_limits || 0} active bandwidth limits • Platform: ${status.platform}`
                    : status.error || 'Tool not found or not configured'
                  }
                </p>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${
              status.available ? 'bg-white animate-pulse' : 'bg-gray-300'
            }`} />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Devices</p>
              <p className="text-3xl font-bold text-gray-800">{devices.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500">
              <Wifi size={28} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Limits</p>
              <p className="text-3xl font-bold text-purple-600">{limits.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-purple-500">
              <Gauge size={28} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Throttled Devices</p>
              <p className="text-3xl font-bold text-orange-600">
                {limits.filter(l => (l.download_limit || 0) > 0 || (l.upload_limit || 0) > 0).length}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-orange-500">
              <TrendingDown size={28} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Blocked Devices</p>
              <p className="text-3xl font-bold text-red-600">
                {limits.filter(l => l.download_limit === 0 && l.upload_limit === 0).length}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-red-500">
              <Ban size={28} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Quick Actions</h3>
          <div className="flex space-x-3">
            <button
              onClick={fetchAllData}
              className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
            {limits.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={loading}
                className="flex items-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                <X size={18} />
                <span>Clear All Limits</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Network Devices</h3>
          <p className="text-sm text-gray-600 mt-1">
            Apply bandwidth limits or block devices
          </p>
        </div>

        {devices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MAC Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Limit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {devices.map((device) => {
                  const limit = getDeviceLimit(device.ip);
                  const isBlocked = limit && limit.download_limit === 0 && limit.upload_limit === 0;
                  const hasLimit = limit && !isBlocked;

                  return (
                    <tr key={device.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{device.hostname}</p>
                          <p className="text-xs text-gray-500">{device.role}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{device.ip}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{device.mac}</td>
                      <td className="px-6 py-4">
                        {limit ? (
                          <div className="space-y-1">
                            {isBlocked ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <Ban size={12} className="mr-1" /> Blocked
                              </span>
                            ) : (
                              <>
                                {limit.download_limit && (
                                  <div className="flex items-center text-xs text-gray-600">
                                    <Download size={12} className="mr-1" />
                                    {limit.download_limit} KB/s
                                  </div>
                                )}
                                {limit.upload_limit && (
                                  <div className="flex items-center text-xs text-gray-600">
                                    <Upload size={12} className="mr-1" />
                                    {limit.upload_limit} KB/s
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No limit</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          isBlocked ? 'bg-red-100 text-red-800' :
                          hasLimit ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {isBlocked ? 'Blocked' : hasLimit ? 'Limited' : 'Unrestricted'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openLimitModal(device)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Set Limit"
                          >
                            <Gauge size={16} />
                          </button>
                          {!isBlocked && (
                            <button
                              onClick={() => handleBlockDevice(device)}
                              disabled={loading}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              title="Block Device"
                            >
                              <Ban size={16} />
                            </button>
                          )}
                          {limit && (
                            <button
                              onClick={() => handleRemoveLimit(device.ip)}
                              disabled={loading}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                              title="Remove Limit"
                            >
                              <Check size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Wifi size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Devices Found</h3>
            <p className="text-gray-600">Scan your network to discover devices</p>
          </div>
        )}
      </div>

      {/* Active Limits Section */}
      {limits.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Active Bandwidth Limits</h3>
            <p className="text-sm text-gray-600 mt-1">
              Currently applied bandwidth restrictions
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {limits.map((limit) => {
                const isBlocked = limit.download_limit === 0 && limit.upload_limit === 0;
                
                return (
                  <div
                    key={limit.id}
                    className={`p-4 rounded-xl border-2 ${
                      isBlocked 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-purple-50 border-purple-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">
                          {limit.hostname || 'Unknown Device'}
                        </h4>
                        <p className="text-xs text-gray-600 font-mono">{limit.target_ip}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveLimit(limit.target_ip)}
                        disabled={loading}
                        className="p-1 hover:bg-white rounded transition-colors"
                        title="Remove"
                      >
                        <X size={16} className="text-gray-600" />
                      </button>
                    </div>

                    {isBlocked ? (
                      <div className="flex items-center space-x-2 text-red-700">
                        <Ban size={18} />
                        <span className="font-medium">All Traffic Blocked</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {limit.download_limit && (
                          <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                            <div className="flex items-center space-x-2 text-sm text-gray-700">
                              <Download size={14} />
                              <span>Download</span>
                            </div>
                            <span className="font-semibold text-purple-700">
                              {limit.download_limit} KB/s
                            </span>
                          </div>
                        )}
                        {limit.upload_limit && (
                          <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                            <div className="flex items-center space-x-2 text-sm text-gray-700">
                              <Upload size={14} />
                              <span>Upload</span>
                            </div>
                            <span className="font-semibold text-purple-700">
                              {limit.upload_limit} KB/s
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Limit Modal */}
      {showLimitModal && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">Set Bandwidth Limit</h3>
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {selectedDevice.hostname} ({selectedDevice.ip})
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-2">
                    <Download size={16} />
                    <span>Download Limit (KB/s)</span>
                  </div>
                </label>
                <input
                  type="number"
                  value={downloadLimit}
                  onChange={(e) => setDownloadLimit(e.target.value)}
                  placeholder="e.g., 1024 (1 MB/s)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for no download limit
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-2">
                    <Upload size={16} />
                    <span>Upload Limit (KB/s)</span>
                  </div>
                </label>
                <input
                  type="number"
                  value={uploadLimit}
                  onChange={(e) => setUploadLimit(e.target.value)}
                  placeholder="e.g., 512 (500 KB/s)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for no upload limit
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
                    <p className="font-semibold mb-1">Common Limits:</p>
                    <ul className="space-y-1">
                      <li>• 128 KB/s = ~1 Mbps (Basic browsing)</li>
                      <li>• 512 KB/s = ~4 Mbps (SD video)</li>
                      <li>• 1024 KB/s = ~8 Mbps (HD video)</li>
                      <li>• 0 KB/s = Complete block</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex space-x-3">
              <button
                onClick={() => setShowLimitModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyLimit}
                disabled={loading || (!downloadLimit && !uploadLimit)}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Applying...' : 'Apply Limit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-indigo-500 rounded-xl">
            <Settings size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-800 mb-2">How Network Control Works</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• <strong>Set Limits:</strong> Control download/upload speeds for specific devices</li>
              <li>• <strong>Block Traffic:</strong> Set limits to 0 KB/s to completely block a device</li>
              <li>• <strong>Real-time Control:</strong> Changes take effect immediately</li>
              <li>• <strong>Per-Device:</strong> Each device can have independent bandwidth limits</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}