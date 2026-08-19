import uvicorn
import os

if __name__ == "__main__":
    app_dir = os.path.dirname(os.path.abspath(__file__))
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True, reload_dirs=[app_dir])
