import json
import os
import shutil

base_dir = "products/ZolexoraERP/backend/zolexora_core/zolexora_core/workspace"
duplicates = ["zolexora_accounts", "zolexora_purchase", "zolexora_sales", "zolexora_inventory", "zolexora_administration", "zolexora_crm"]
renames = {
    "zolexora_ai": "ai",
    "zolexora_analytics": "analytics",
    "zolexora_dashboard": "dashboard",
    "zolexora_fleet": "fleet",
    "zolexora_logistics": "logistics"
}

# 1. Delete duplicates
for dup in duplicates:
    path = os.path.join(base_dir, dup)
    if os.path.exists(path):
        shutil.rmtree(path)
        print(f"Deleted duplicate wrapper: {path}")

# 2. Rename the valid Zolexora modules
for old_name, new_name in renames.items():
    old_path = os.path.join(base_dir, old_name)
    new_path = os.path.join(base_dir, new_name)
    if os.path.exists(old_path):
        os.rename(old_path, new_path)
        print(f"Renamed {old_path} to {new_path}")
        
        # update the json inside
        old_json = os.path.join(new_path, f"{old_name}.json")
        new_json = os.path.join(new_path, f"{new_name}.json")
        if os.path.exists(old_json):
            with open(old_json, 'r') as f:
                data = json.load(f)
            
            # Remove "Zolexora " prefix from label, title, and name
            if data.get("label", "").startswith("Zolexora "):
                data["label"] = data["label"].replace("Zolexora ", "")
            if data.get("title", "").startswith("Zolexora "):
                data["title"] = data["title"].replace("Zolexora ", "")
            if data.get("name", "").startswith("Zolexora "):
                data["name"] = data["name"].replace("Zolexora ", "")
            
            with open(new_json, 'w') as f:
                json.dump(data, f, indent=1)
            os.remove(old_json)
            print(f"Updated JSON inside {new_name}")

# 3. Update fixtures/workspace.json
fixture_path = "products/ZolexoraERP/backend/zolexora_core/zolexora_core/fixtures/workspace.json"
if os.path.exists(fixture_path):
    with open(fixture_path, 'r') as f:
        fixtures = json.load(f)
    
    new_fixtures = []
    for fix in fixtures:
        name = fix.get("name", "")
        # skip duplicates
        if name in ["Zolexora Accounts", "Zolexora Purchase", "Zolexora Sales", "Zolexora Inventory", "Zolexora Administration", "Zolexora CRM"]:
            continue
        
        # update the rest
        if name.startswith("Zolexora "):
            fix["label"] = fix.get("label", "").replace("Zolexora ", "")
            fix["title"] = fix.get("title", "").replace("Zolexora ", "")
            fix["name"] = fix.get("name", "").replace("Zolexora ", "")
        
        new_fixtures.append(fix)
        
    with open(fixture_path, 'w') as f:
        json.dump(new_fixtures, f, indent=1)
    print("Updated fixtures/workspace.json")

