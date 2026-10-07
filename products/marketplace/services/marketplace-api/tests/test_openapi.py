import json
import subprocess
import sys
from pathlib import Path

def test_openapi_deterministic_generation():
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    script_path = root_dir / "scripts" / "generate_openapi.py"
    openapi_path = root_dir / "contracts" / "marketplace" / "openapi.json"
    
    # Run first time
    subprocess.run([sys.executable, str(script_path)], check=True)
    with open(openapi_path, "r") as f:
        run1 = f.read()
        
    # Run second time
    subprocess.run([sys.executable, str(script_path)], check=True)
    with open(openapi_path, "r") as f:
        run2 = f.read()
        
    assert run1 == run2
    
    # Check it parses as valid JSON
    schema = json.loads(run1)
    assert "openapi" in schema
    assert "info" in schema
