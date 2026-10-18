import os

def replace_in_files(directory, old_str, new_str, extensions=None):
    if not os.path.exists(directory):
        return
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in root or '.turbo' in root or 'dist' in root or '.git' in root or '.pnpm-store' in root or '.venv' in root:
            continue
        for file in files:
            if extensions and not any(file.endswith(ext) for ext in extensions):
                continue
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                if old_str in content:
                    content = content.replace(old_str, new_str)
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Patched: {filepath}")
            except Exception as e:
                pass

print("Patching Zolexora AI (8000 -> 4090)")
replace_in_files('products/zolexora-ai', '8000', '4090')

print("Patching Zolexora Marketplace (8000 -> 4100)")
replace_in_files('products/zolexora-marketplace', '8000', '4100')

print("Patching Zolexora TMS (8000 -> 4030)")
replace_in_files('products/zolexora-tms', '8000', '4030')

print("Patching Zolexora IMS User (8000 -> 4050)")
replace_in_files('products/zolexora-ims/apps/ims-user', '8000', '4050')

print("Patching Zolexora IMS Admin (8001 -> 4051)")
replace_in_files('products/zolexora-ims/apps/ims-admin', '8001', '4051')

# Also IMS root package.json for its scripts
replace_in_files('products/zolexora-ims', '8000', '4050', extensions=['.json'])
replace_in_files('products/zolexora-ims', '8001', '4051', extensions=['.json'])

print("Patching The Textile Care (8000 -> 4010)")
replace_in_files('products/the-textile-care', '8000', '4010')

print("Patching Rento Easy (8000 -> 4020)")
replace_in_files('products/rentoeasy', '8000', '4020')

print("Done.")
