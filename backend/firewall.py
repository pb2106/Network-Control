import platform
import subprocess
from typing import Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_system_type():
    """Detect the operating system"""
    return platform.system().lower()

def check_self_block(target_ip: str) -> bool:
    """Check if we're about to block ourselves"""
    import socket
    local_ips = []
    
    try:
        hostname = socket.gethostname()
        local_ips.append(socket.gethostbyname(hostname))
        
        # Get all local IPs
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ips.append(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    
    return target_ip in local_ips

def block_ip_linux(ip: str) -> Dict:
    """Block IP on Linux using iptables"""
    if check_self_block(ip):
        return {"success": False, "message": "Cannot block local IP"}
    
    try:
        # Check if rule already exists
        check_cmd = ["sudo", "iptables", "-C", "INPUT", "-s", ip, "-j", "DROP"]
        result = subprocess.run(check_cmd, capture_output=True)
        
        if result.returncode != 0:
            # Rule doesn't exist, add it
            cmd = ["sudo", "iptables", "-A", "INPUT", "-s", ip, "-j", "DROP"]
            subprocess.run(cmd, check=True, capture_output=True)
        
        return {"success": True, "message": f"IP {ip} blocked successfully"}
    except subprocess.CalledProcessError as e:
        return {"success": False, "message": f"Failed to block IP: {str(e)}"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

def unblock_ip_linux(ip: str) -> Dict:
    """Unblock IP on Linux using iptables"""
    try:
        cmd = ["sudo", "iptables", "-D", "INPUT", "-s", ip, "-j", "DROP"]
        subprocess.run(cmd, check=True, capture_output=True)
        return {"success": True, "message": f"IP {ip} unblocked successfully"}
    except subprocess.CalledProcessError:
        return {"success": False, "message": "Rule not found or already removed"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

def block_ip_windows(ip: str) -> Dict:
    """Block IP on Windows using Windows Firewall"""
    if check_self_block(ip):
        return {"success": False, "message": "Cannot block local IP"}
    
    try:
        rule_name = f"Block_{ip.replace('.', '_')}"
        
        # Check if rule exists
        check_cmd = ["netsh", "advfirewall", "firewall", "show", "rule", f"name={rule_name}"]
        result = subprocess.run(check_cmd, capture_output=True, text=True)
        
        if "No rules match" in result.stdout:
            # Create new rule
            cmd = [
                "netsh", "advfirewall", "firewall", "add", "rule",
                f"name={rule_name}",
                "dir=in",
                "action=block",
                f"remoteip={ip}"
            ]
            subprocess.run(cmd, check=True, capture_output=True)
        
        return {"success": True, "message": f"IP {ip} blocked successfully"}
    except subprocess.CalledProcessError as e:
        return {"success": False, "message": f"Failed to block IP: {str(e)}"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

def unblock_ip_windows(ip: str) -> Dict:
    """Unblock IP on Windows using Windows Firewall"""
    try:
        rule_name = f"Block_{ip.replace('.', '_')}"
        cmd = ["netsh", "advfirewall", "firewall", "delete", "rule", f"name={rule_name}"]
        subprocess.run(cmd, check=True, capture_output=True)
        return {"success": True, "message": f"IP {ip} unblocked successfully"}
    except subprocess.CalledProcessError:
        return {"success": False, "message": "Rule not found"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

def block_ip_macos(ip: str) -> Dict:
    """Block IP on macOS using pfctl"""
    if check_self_block(ip):
        return {"success": False, "message": "Cannot block local IP"}
    
    try:
        # Add to pf table
        cmd = ["sudo", "pfctl", "-t", "blocklist", "-T", "add", ip]
        subprocess.run(cmd, check=True, capture_output=True)
        return {"success": True, "message": f"IP {ip} blocked successfully"}
    except subprocess.CalledProcessError as e:
        return {"success": False, "message": f"Failed to block IP: {str(e)}"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

def unblock_ip_macos(ip: str) -> Dict:
    """Unblock IP on macOS using pfctl"""
    try:
        cmd = ["sudo", "pfctl", "-t", "blocklist", "-T", "delete", ip]
        subprocess.run(cmd, check=True, capture_output=True)
        return {"success": True, "message": f"IP {ip} unblocked successfully"}
    except subprocess.CalledProcessError:
        return {"success": False, "message": "IP not in blocklist"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

def block_ip(ip: str) -> Dict:
    """Block IP address based on OS"""
    system = get_system_type()
    
    logger.info(f"Attempting to block IP {ip} on {system}")
    
    if system == "linux":
        return block_ip_linux(ip)
    elif system == "windows":
        return block_ip_windows(ip)
    elif system == "darwin":
        return block_ip_macos(ip)
    else:
        return {"success": False, "message": f"Unsupported OS: {system}"}

def unblock_ip(ip: str) -> Dict:
    """Unblock IP address based on OS"""
    system = get_system_type()
    
    logger.info(f"Attempting to unblock IP {ip} on {system}")
    
    if system == "linux":
        return unblock_ip_linux(ip)
    elif system == "windows":
        return unblock_ip_windows(ip)
    elif system == "darwin":
        return unblock_ip_macos(ip)
    else:
        return {"success": False, "message": f"Unsupported OS: {system}"}