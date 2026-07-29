
import os
import json
import re

def parse_js_file(file_path):
    children = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for i, line in enumerate(lines):
                # Function declarations
                match_func = re.search(r'function\s+(\w+)\s*\(', line)
                if match_func:
                    children.append({
                        "name": match_func.group(1),
                        "type": "Function",
                        "line": i + 1,
                        "file": os.path.basename(file_path),
                        "snippet": line.strip()
                    })
                # Class declarations
                match_class = re.search(r'class\s+(\w+)', line)
                if match_class:
                    children.append({
                        "name": match_class.group(1),
                        "type": "Class",
                        "line": i + 1,
                        "file": os.path.basename(file_path),
                        "snippet": line.strip()
                    })
                # Arrow functions or variable assignments
                match_var = re.search(r'(const|let|var)\s+(\w+)\s*=\s*(\(.*\)|async\s*\(.*\)|function)', line)
                if match_var:
                     children.append({
                        "name": match_var.group(2),
                        "type": "Variable/Function",
                         "line": i + 1,
                        "file": os.path.basename(file_path),
                        "snippet": line.strip()
                    })
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
    return children

def parse_html_file(file_path):
    children = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for i, line in enumerate(lines):
                # ID attributes
                match_id = re.search(r'id=["\']([^"\']+)["\']', line)
                if match_id:
                     children.append({
                        "name": "#" + match_id.group(1),
                        "type": "Element ID",
                         "line": i + 1,
                        "file": os.path.basename(file_path),
                        "snippet": line.strip()
                    })
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
    return children


def build_tree(root_dir):
    tree = {"name": "one-touch-map", "children": []}
    
    # Define structure grouping
    groups = {
        "Frontend": ["index.html", "map.html", "list.html", "settings.html", "gpstest.html", "main-style.css", "list-style.css", "settings-style.css"],
        "Core Logic": ["main-app.js", "list-app.js", "map-app.js", "ocr-app.js", "route-optimizer.js", "anchor-system.js", "national-regions.js"],
        "Config": ["manifest.json", "service-worker.js", "package.json", "capacitor.config.json"],
        "Tools": ["fix_map.py", "convert-icon.js"],
        "Android": ["android"] # Just folder
    }

    # Helper to add file node
    def add_file_node(parent_list, file_name, full_path):
        node = {
            "name": file_name,
            "type": "File",
            "file": file_name,
            "children": []
        }
        
        if file_name.endswith('.js'):
            node["children"] = parse_js_file(full_path)
            node["type"] = "File (JS)"
        elif file_name.endswith('.html'):
            node["children"] = parse_html_file(full_path)
            node["type"] = "File (HTML)"
        elif file_name.endswith('.py'):
            # Simple python parser
             try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    for i, line in enumerate(f):
                         if line.strip().startswith("def ") or line.strip().startswith("class "):
                             name = line.strip().split(' ')[1].split('(')[0]
                             node["children"].append({
                                 "name": name, 
                                 "type": "Function/Class",
                                 "line": i+1,
                                 "file": file_name,
                                 "snippet": line.strip()
                             })
             except: pass
             node["type"] = "File (Python)"
        
        # Filter out empty children if desired, or keep them
        parent_list.append(node)

    # Process groups
    for group_name, files in groups.items():
        group_node = {"name": group_name, "type": "Folder", "children": []}
        for fname in files:
            full_path = os.path.join(root_dir, fname)
            if os.path.exists(full_path):
                if os.path.isdir(full_path):
                     group_node["children"].append({"name": fname, "type": "Folder", "children": []})
                else:
                    add_file_node(group_node["children"], fname, full_path)
        tree["children"].append(group_node)
        
    # Catch-all for other files? (Skip for now to keep it clean as requested)

    return tree

if __name__ == "__main__":
    data = build_tree(".")
    with open("mindmap_data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("JSON data saved to mindmap_data.json")
