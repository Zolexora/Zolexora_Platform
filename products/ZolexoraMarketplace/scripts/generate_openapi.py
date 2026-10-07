#!/usr/bin/env python3
import json
import sys
from pathlib import Path

# Insert services/marketplace-api to sys.path so we can import the FastAPI app
api_dir = Path(__file__).resolve().parent.parent / "services" / "marketplace-api"
sys.path.insert(0, str(api_dir))

from main import app

def main():
    out_dir = Path(__file__).resolve().parent.parent / "contracts" / "marketplace"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "openapi.json"
    
    schema = app.openapi()
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)
    
    print(f"✅ OpenAPI schema successfully exported to {out_path}")

if __name__ == "__main__":
    main()
