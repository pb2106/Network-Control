import { useState, useEffect } from 'react';
import axios from 'axios';
import { useWebSocket } from '../context/WebSocketContext';
import { AlertTriangle, Info, XCircle, CheckCircle, Trash2 } from 'lucide-react';

interface Alert {
  id: number;
  message: string;
  level: string;
  timestamp: string;
  read: boolean;
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState('all');
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (lastMessage) {
      fetchAlerts();
    }
  }, [lastMessage]);

  const fetchAlerts = async () => {
    try {
      const response = await axios.get('/api/alerts/');
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  const markAsRead = async (alertId: number) => {
    try {
      await axios.patch(`/api/alerts/${alertId}/read`);
      fetchAlerts();
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post('/api/alerts/mark-all-read');
      fetchAlerts();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteAlert = async (alertId: number) => {
    try {
      await axios.delete(`/api/alerts/${alertId}`);
      fetchAlerts();
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'info':
        return <Info className="text-blue-500" size={20} />;
      case 'warning':
        return <AlertTriangle className="text-orange-500" size={20} />;
      case 'danger':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <Info className="text-gray-500" size={20} />;
    }
  };

  const getAlertBgColor = (level: string) => {
    switch (level) {
      case 'info':
        return 'bg-blue-50 border-blue-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      case 'danger':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !alert.read;
    return alert.level === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center space-x-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
            >
              <option value="all">All Alerts</option>
              <option value="unread">Unread</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="danger">Danger</option>
            </select>
          </div>
          <button
            onClick={markAllAsRead}
            className="flex items-center space-x-2 bg-accent text-white px-4 py-2 rounded-xl hover:bg-blue-600 transition-colors"
          >
            <CheckCircle size={18} />
            <span>Mark All as Read</span>
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-200 text-center">
            <AlertTriangle size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No alerts</h3>
            <p className="text-gray-600">All clear! No alerts to display.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl shadow-sm p-6 border ${getAlertBgColor(alert.level)} ${
                !alert.read ? 'border-l-4' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="mt-1">{getAlertIcon(alert.level)}</div>
                  <div className="flex-1">
                    <p className="text-gray-800 font-medium">{alert.message}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {!alert.read && (
                    <button
                      onClick={() => markAsRead(alert.id)}
                      className="p-2 text-gray-600 hover:bg-white rounded-lg transition-colors"
                      title="Mark as read"
                    >
                      <CheckCircle size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-2 text-red-600 hover:bg-white rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}