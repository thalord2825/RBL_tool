import subprocess
import time

def kill_port(port):
    try:
        cmd = f'powershell -NoProfile -Command "$pids = Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $pids) {{ if ($p -and $p -ne 0) {{ Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }} }}"'
        subprocess.run(cmd, shell=True, capture_output=True)
    except Exception:
        pass

def main():
    print("=" * 60)
    print("       RBL RESEARCH TOOL - 1-CLICK EMERGENCY SHUTDOWN        ")
    print("=" * 60)
    print("\nTerminating all Backend & Frontend processes...")
    
    for port in [8000, 5173, 5174, 5175]:
        kill_port(port)
        print(f"  [RELEASED] Port {port}")

    subprocess.run('taskkill /FI "WINDOWTITLE eq RBL_Backend_Server*" /T /F', shell=True, capture_output=True)
    subprocess.run('taskkill /FI "WINDOWTITLE eq RBL_Frontend_Server*" /T /F', shell=True, capture_output=True)
    subprocess.run('wmic process where "commandline like \'%app.main:app%\' or commandline like \'%vite%\'" delete', shell=True, capture_output=True)

    print("\n[SUCCESS] All RBL servers and background processes killed.")
    time.sleep(2.0)

if __name__ == "__main__":
    main()
