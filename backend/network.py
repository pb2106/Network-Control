import platform
import subprocess
import socket
from typing import List, Dict
import ipaddress
import concurrent.futures

def get_local_ip():
    """Get the local IP address of the machine"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"

def get_network_range():
    """Calculate network range based on local IP"""
    try:
        local_ip = get_local_ip()
        # Assume /24 subnet
        network = ipaddress.IPv4Network(f"{local_ip}/24", strict=False)
        return str(network)
    except Exception:
        return "192.168.1.0/24"

def ping_host(ip: str, timeout: int = 1) -> bool:
    """Ping a host to check if it's alive"""
    system = platform.system().lower()
    
    if system == "windows":
        command = ["ping", "-n", "1", "-w", str(timeout * 1000), ip]
    else:
        command = ["ping", "-c", "1", "-W", str(timeout), ip]
    
    try:
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout + 1
        )
        return result.returncode == 0
    except Exception:
        return False

def get_hostname(ip: str) -> str:
    """Get hostname from IP address"""
    try:
        hostname = socket.gethostbyaddr(ip)[0]
        return hostname
    except Exception:
        return "Unknown"

def get_mac_address(ip: str) -> str:
    """Get MAC address from IP using ARP"""
    system = platform.system().lower()
    
    try:
        if system == "windows":
            output = subprocess.check_output(["arp", "-a", ip], text=True)
            for line in output.split("\n"):
                if ip in line:
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if ip in part and i + 1 < len(parts):
                            mac = parts[i + 1]
                            if "-" in mac or ":" in mac:
                                return mac.replace("-", ":")
        else:
            output = subprocess.check_output(["arp", "-n", ip], text=True)
            for line in output.split("\n"):
                if ip in line:
                    parts = line.split()
                    if len(parts) >= 3:
                        mac = parts[2] if system == "linux" else parts[3]
                        if ":" in mac:
                            return mac
    except Exception:
        pass
    
    return "00:00:00:00:00:00"

def scan_single_host(ip: str) -> Dict:
    """Scan a single host and return device info"""
    if ping_host(ip):
        hostname = get_hostname(ip)
        mac = get_mac_address(ip)
        return {
            "ip": ip,
            "hostname": hostname,
            "mac": mac,
            "status": "active"
        }
    return None

def scan_network(network_range: str = None) -> List[Dict]:
    """Scan the local network for active devices"""
    if network_range is None:
        network_range = get_network_range()
    
    try:
        network = ipaddress.IPv4Network(network_range, strict=False)
    except Exception:
        return []
    
    devices = []
    
    # Use ThreadPoolExecutor for parallel scanning
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = {executor.submit(scan_single_host, str(ip)): ip for ip in network.hosts()}
        
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result:
                devices.append(result)
    
    return devices

def is_suspicious_request(ip: str, request_count: int, threshold: int = 100) -> bool:
    """Check if request count from IP is suspicious"""
    return request_count > threshold