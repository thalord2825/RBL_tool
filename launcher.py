import os
import sys
import time
import subprocess
import urllib.request
import webbrowser
import socket

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

def kill_process_on_port(port: int):
    """Find and kill any process holding the given port on Windows."""
    try:
        cmd = f'powershell -NoProfile -Command "$pids = Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $pids) {{ if ($p -and $p -ne 0) {{ Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }} }}"'
        subprocess.run(cmd, shell=True, capture_output=True)
    except Exception as e:
        print(f"[WARNING] Failed to clean port {port}: {e}")

def is_service_healthy(url: str, timeout: float = 1.0) -> bool:
    """Check if an HTTP endpoint returns status 200."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RBL-Launcher"})
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status == 200
    except Exception:
        return False

def sync_dependencies():
    """Verify pip packages and node_modules."""
    print("[1/5] Checking Python dependencies...")
    req_file = os.path.join(BACKEND_DIR, "requirements.txt")
    if os.path.exists(req_file):
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", req_file, "--quiet", "--disable-pip-version-check"],
            cwd=BACKEND_DIR
        )

    print("[2/5] Checking Node dependencies...")
    node_modules = os.path.join(ROOT_DIR, "node_modules")
    if not os.path.exists(node_modules):
        subprocess.run(["npm", "install", "--no-audit", "--silent"], cwd=ROOT_DIR, shell=True)

def main():
    print("=" * 65)
    print("       RBL RESEARCH INTELLIGENCE - 1-CLICK EXECUTABLE LAUNCHER    ")
    print("=" * 65)
    print()

    # Step 1: Self-Healing Port Cleanup
    print("[3/5] Cleaning ports (8000, 5173, 5174)...")
    kill_process_on_port(8000)
    kill_process_on_port(5173)
    kill_process_on_port(5174)
    time.sleep(1.0)

    # Step 2: Sync dependencies
    sync_dependencies()

    # Step 3: Launch Backend and Frontend
    print("[4/5] Launching Backend & Frontend services...")
    
    # Run FastAPI Backend
    backend_proc = subprocess.Popen(
        [sys.executable, "run.py"],
        cwd=BACKEND_DIR,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    )

    # Run Vite Frontend
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=ROOT_DIR,
        shell=True,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    )

    # Step 4: Health Check Loop
    print("[5/5] Waiting for services to become healthy...")
    max_wait = 30
    backend_ok = False
    frontend_ok = False

    for i in range(max_wait):
        sys.stdout.write(".")
        sys.stdout.flush()

        if not backend_ok:
            backend_ok = is_service_healthy("http://127.0.0.1:8000/")
        if not frontend_ok:
            frontend_ok = is_service_healthy("http://localhost:5173/")

        if backend_ok and frontend_ok:
            break
        time.sleep(1.0)

    print()
    if backend_ok and frontend_ok:
        print("\n[SUCCESS] All systems are ONLINE and HEALTHY!")
    else:
        print("\n[WARNING] Timed out waiting for full health confirmation, opening browser anyway...")

    print("=" * 65)
    print("  Webapp:  http://localhost:5173/")
    print("  Backend: http://127.0.0.1:8000/")
    print("=" * 65)
    
    webbrowser.open("http://localhost:5173/")
    print("\nApplication is running. Keep this window open or close it (servers stay in background).")
    input("\nPress ENTER to shut down all servers and exit...")

    print("[SHUTDOWN] Terminating servers...")
    backend_proc.terminate()
    kill_process_on_port(8000)
    kill_process_on_port(5173)
    kill_process_on_port(5174)
    print("[SUCCESS] All servers shut down cleanly.")

if __name__ == "__main__":
    main()
