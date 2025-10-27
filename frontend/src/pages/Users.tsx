import { useState, useEffect } from 'react';
import axios from 'axios';
import { useWebSocket } from '../context/WebSocketContext';
import { Shield, Ban, UserX, Edit2, Trash2 } from 'lucide-react';

interface Device {
  id: number;
  mac: string;
  ip: string;
  hostname: string;
  role: string;
  status: string;
  last_seen: string;
}

export default function Users() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (lastMessage && (lastMessage.type === 'device_updated' || lastMessage.type === 'device_kicked')) {
      fetchDevices();
    }
  }, [lastMessage]);

  const fetchDevices = async () => {
    try {
      const response = await axios.get('/api/devices/');
      setDevices(response.data);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const handleRoleChange = async (deviceId: number, newRole: string) => {
    try {
      await axios.patch(`/api/devices/${deviceId}`, { role: newRole });
      setEditingDevice(null);
      fetchDevices();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleKick = async (deviceId: number) => {
    if (!confirm('Are you sure you want to kick this device?')) return;
    
    try {
      await axios.post(`/api/firewall/kick/${deviceId}`);
      fetchDevices();
    } catch (error) {
      console.error('Failed to kick device:', error);
      alert('Failed to kick device. Check console for details.');
    }
  };

  const handleBlock = async (device: Device) => {
    if (!confirm(`Are you sure you want to block ${device.ip}?`)) return;
    
    try {
      await axios.post('/api/firewall/action', {
        ip: device.ip,
        action: 'block'
      });
      fetchDevices();
    } catch (error) {
      console.error('Failed to block device:', error);
      alert('Failed to block device. Check console for details.');
    }
  };

  const handleUnblock = async (device: Device) => {
    try {
      await axios.post('/api/firewall/action', {
        ip: device.ip,
        action: 'unblock'
      });
      fetchDevices();
    } catch (error) {
      console.error('Failed to unblock device:', error);
    }
  };

  const filteredDevices = devices.filter(device => {
    const matchesFilter = filter === 'all' || device.role.toLowerCase() === filter.toLowerCase();
    const matchesSearch = 
      device.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.ip.includes(searchTerm) ||
      device.mac.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by hostname, IP, or MAC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="volunteer">Volunteer</option>
            <option value="others">Others</option>
          </select>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Devices & Users</h3>
          <p className="text-sm text-gray-600 mt-1">Manage device roles and access control</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Network</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDevices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{device.hostname}</div>
                      <div className="text-xs text-gray-500 font-mono">{device.mac}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-800">{device.ip}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(device.last_seen).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editingDevice?.id === device.id ? (
                      <select
                        value={device.role}
                        onChange={(e) => handleRoleChange(device.id, e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Volunteer">Volunteer</option>
                        <option value="Others">Others</option>
                      </select>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        device.role === 'Admin' ? 'bg-purple-100 text-purple-800' :
                        device.role === 'Volunteer' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {device.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      device.status === 'active' ? 'bg-green-100 text-green-800' :
                      device.status === 'blocked' ? 'bg-red-100 text-red-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {device.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingDevice(device)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit Role"
                      >
                        <Edit2 size={16} />
                      </button>
                      {device.status === 'blocked' ? (
                        <button
                          onClick={() => handleUnblock(device)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Unblock"
                        >
                          <Shield size={16} />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleBlock(device)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Block"
                          >
                            <Ban size={16} />
                          </button>
                          <button
                            onClick={() => handleKick(device.id)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Kick"
                          >
                            <UserX size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}