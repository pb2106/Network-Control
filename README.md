# Network & User Management Dashboard

A cross-platform, local-first network management tool with real-time multi-admin synchronization, remote firewall control, and enterprise-grade UI.

## 🎯 Features

- **Network Scanning**: Automatically discover devices on your local network
- **Device Management**: Categorize devices as Admin, Volunteer, or Others
- **Role-Based Access Control**: JWT authentication with bcrypt password hashing
- **Real-Time Sync**: Multi-admin collaboration via WebSockets
- **Firewall Management**: Remote block/unblock/kick capabilities across platforms
- **Alert System**: Real-time notifications for suspicious activity
- **Local Database**: All data stored in SQLite (network.db)
- **Cross-Platform**: Works on Windows, Linux, and macOS

## 📦 Project Structure

```
project/
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── db.py                # Database models and initialization
│   ├── auth.py              # JWT authentication and password hashing
│   ├── network.py           # Network scanning utilities
│   ├── firewall.py          # Cross-platform firewall management
│   ├── sync.py              # WebSocket connection manager
│   ├── requirements.txt     # Python dependencies
│   └── routers/
│       ├── devices.py       # Device management endpoints
│       ├── users.py         # User management endpoints
│       ├── alerts.py        # Alert management endpoints
│       └── firewall.py      # Firewall control endpoints
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── context/
│       │   ├── AuthContext.tsx
│       │   └── WebSocketContext.tsx
│       ├── components/
│       │   └── Layout.tsx
│       └── pages/
│           ├── Login.tsx
│           ├── Dashboard.tsx
│           ├── Users.tsx
│           ├── Alerts.tsx
│           └── Settings.tsx
│
└── network.db               # SQLite database (auto-created)
```

## 🚀 Installation & Setup

### Prerequisites

- **Python 3.9+**
- **Node.js 18+**
- **Elevated privileges** (sudo/admin) for firewall operations

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv

# On Windows
venv\Scripts\activate

# On Linux/macOS
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the backend server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173`

### Default Credentials

- **Username**: `admin`
- **Password**: `admin123`

**⚠️ IMPORTANT**: Change the default password immediately after first login in production!

## 🔧 Configuration

### Backend Configuration

Edit `backend/auth.py` to change:
- `SECRET_KEY`: Change for production use
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Token expiration time

### Frontend Configuration

Edit `frontend/vite.config.ts` to change:
- API proxy settings
- Development server port

## 🛡️ Firewall Safety Guidelines

### Linux (iptables/nftables)

- Requires `sudo` privileges
- Commands: `sudo iptables -A INPUT -s <IP> -j DROP`
- **Self-Protection**: The system prevents blocking your own IP
- **Rollback**: Use unblock to remove rules

### Windows (Windows Firewall)

- Requires Administrator privileges
- Uses `netsh advfirewall firewall` commands
- Rules are named: `Block_<IP_with_underscores>`

### macOS (pfctl)

- Requires `sudo` privileges
- Uses packet filter control
- Blocks are added to the `blocklist` table

### Safety Features

1. **Self-Block Prevention**: System checks if target IP matches local IPs
2. **Logging**: All firewall actions logged in `firewall_logs` table
3. **Rollback**: Every block can be undone via unblock action
4. **Validation**: IP addresses validated before execution

## 🔄 Multi-Admin Synchronization

### How It Works

1. Multiple admins connect to the same backend server
2. WebSocket connection established at `/ws/sync`
3. All actions (device updates, blocks, kicks) broadcast in real-time
4. Timestamp-based conflict resolution (last-write-wins)

### Conflict Resolution

- Each update includes a timestamp
- Latest update takes precedence
- All clients receive sync messages
- Database writes are serialized via FastAPI

### Connection Recovery

- Automatic reconnection after 3 seconds
- Message history sent to new connections
- No data loss during brief disconnections

## 📊 Database Schema

### devices
- `id`: Primary key
- `mac`: MAC address (unique)
- `ip`: IP address
- `hostname`: Device hostname
- `role`: Admin/Volunteer/Others
- `status`: active/blocked/kicked
- `last_seen`: Last detection timestamp
- `updated_at`: Last modification timestamp

### users
- `id`: Primary key
- `username`: Unique username
- `hashed_password`: Bcrypt hashed password
- `role`: admin/viewer
- `last_login`: Last login timestamp
- `created_at`: Account creation timestamp

### alerts
- `id`: Primary key
- `message`: Alert message
- `level`: info/warning/danger
- `timestamp`: Alert creation time
- `read`: Read status boolean

### sessions
- `id`: Primary key
- `user_id`: Reference to user
- `device_id`: Reference to device
- `active`: Session active status
- `started_at`: Session start time
- `ended_at`: Session end time

### firewall_logs
- `id`: Primary key
- `action`: block/unblock/kick
- `target_ip`: Affected IP address
- `admin`: Admin who performed action
- `timestamp`: Action timestamp
- `success`: Success status
- `details`: Additional details/errors

## 🎨 UI Theme

### Color Palette

- **Background Light**: `#F8FAFC`
- **Background Dark**: `#0F172A`
- **Primary**: `#1E293B`
- **Accent**: `#3B82F6`
- **Text Light**: `#111827`
- **Text Dark**: `#E5E7EB`

### Design Principles

- Flat, enterprise-clean aesthetic
- Rounded corners (`rounded-xl`)
- Soft shadows for depth
- Consistent spacing
- Responsive layout

## 🔍 Troubleshooting

### Network Scanning Issues

**Problem**: No devices found
**Solution**: 
- Check network connectivity
- Ensure proper subnet (defaults to /24)
- Run with elevated privileges

### Firewall Operations Fail

**Problem**: "Permission denied" errors
**Solution**:
- Run backend with `sudo` (Linux/macOS)
- Run as Administrator (Windows)
- Check firewall service is running

### WebSocket Connection Issues

**Problem**: Real-time updates not working
**Solution**:
- Check backend is running
- Verify proxy settings in `vite.config.ts`
- Check browser console for errors

### Database Lock Errors

**Problem**: "Database is locked"
**Solution**:
- SQLite has limited concurrent write support
- Backend uses serialized writes
- Reduce concurrent admin actions

## 🚀 Production Deployment

### Security Checklist

- [ ] Change `SECRET_KEY` in `auth.py`
- [ ] Change default admin password
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS for production domain
- [ ] Set up proper firewall rules on host
- [ ] Regular database backups
- [ ] Log rotation for firewall logs

### Recommended Setup

1. **Backend**: Run with systemd (Linux) or Windows Service
2. **Frontend**: Build and serve with nginx/Apache
3. **Database**: Regular automated backups of network.db
4. **Monitoring**: Set up log aggregation

### Building Frontend for Production

```bash
cd frontend
npm run build
```


## 🤝 Contributing

This is a complete, production-ready solution. For modifications:

1. Backend changes: Edit files in `backend/`
2. Frontend changes: Edit files in `frontend/src/`
3. Test thoroughly before deployment
4. Update README with new features

## 📄 License

This project is provided as-is for network management purposes. Use responsibly and in compliance with local laws and regulations.

## ⚠️ Legal Disclaimer

- Only use on networks you own or have permission to manage
- Firewall actions affect network connectivity
- Test in a controlled environment first
- Keep logs for auditing purposes
- Comply with local data protection regulations

## 🆘 Support

For issues:
1. Check troubleshooting section
2. Review console logs (browser & backend)
3. Verify elevated privileges for firewall operations
4. Check database file permissions

---

**Built with**: FastAPI, React, TypeScript, TailwindCSS, SQLite, WebSockets