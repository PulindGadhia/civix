import asyncio
import os
import sys

# Bootstrap: Add virtual environment site-packages to sys.path for cross-platform compatibility
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
venv_dir = os.path.join(base_dir, "venv")
if os.path.exists(venv_dir):
    import glob
    paths = glob.glob(os.path.join(venv_dir, "Lib", "site-packages")) + \
            glob.glob(os.path.join(venv_dir, "lib", "python*", "site-packages"))
    for path in paths:
        if path not in sys.path:
            sys.path.insert(0, path)

if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from app.services.database import DatabaseService

async def main():
    print("Connecting to Firestore database...")
    if not DatabaseService.is_active():
        print("WARNING: Firestore is not active. The migration will run on the fallback MOCK database only.")
    else:
        print("Firestore is active. Proceeding with migration...")
        
    await DatabaseService.migrate_existing_issues()
    print("Database issues ownership migration complete!")

if __name__ == "__main__":
    asyncio.run(main())
