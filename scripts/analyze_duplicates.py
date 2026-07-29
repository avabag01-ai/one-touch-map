
import os
import re

files = [
    '/Users/mac/Documents/GitHub/one-touch-map/main-app.js',
    '/Users/mac/Documents/GitHub/one-touch-map/list-app.js',
    '/Users/mac/Documents/GitHub/one-touch-map/ocr-app.js',
    '/Users/mac/Documents/GitHub/one-touch-map/route-optimizer.js'
]

functions = {}

def normalize_code(code):
    # Remove whitespace and newlines for comparison
    return re.sub(r'\s+', '', code)

for file_path in files:
    if not os.path.exists(file_path):
        continue
        
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Regex to capture function name and body (simple approximation)
    # Matches function foo() { ... }
    matches = re.finditer(r'function\s+(\w+)\s*\(([^)]*)\)\s*\{', content)
    
    for match in matches:
        func_name = match.group(1)
        params = match.group(2)
        start_index = match.end()
        
        # Find matching closing brace
        brace_count = 1
        i = start_index
        while i < len(content) and brace_count > 0:
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
            i += 1
            
        function_body = content[start_index:i-1]
        
        if func_name not in functions:
            functions[func_name] = []
        
        functions[func_name].append({
            'file': os.path.basename(file_path),
            'params': params,
            'body_preview': function_body[:100].strip().replace('\n', ' '),
            'normalized_body': normalize_code(function_body),
            'full_body': function_body
        })

print("=== Duplicate Functions Analysis ===")
dup_count = 0
for func_name, instances in functions.items():
    if len(instances) > 1:
        # Check if bodies are actually similar
        bodies = set(inst['normalized_body'] for inst in instances)
        if len(bodies) == 1:
            print(f"🔴 EXACT DUPLICATE: {func_name}")
        else:
            print(f"🟠 NAME COLLISION (Different Logic): {func_name}")
            
        for inst in instances:
            print(f"   - {inst['file']}: ({inst['params']})")
        dup_count += 1

if dup_count == 0:
    print("No obvious function duplications found.")
    
# Also check for Toast/Alert logic which is common
print("\n=== Common Pattern Analysis ===")
for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        if 'showToast' in content:
            print(f"Toast logic found in {os.path.basename(file_path)}")
        if 'localStorage' in content:
            print(f"localStorage usage found in {os.path.basename(file_path)}")
