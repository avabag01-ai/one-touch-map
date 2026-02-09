import os
import json
import re
import subprocess
from pathlib import Path

class OmegaAnalyzer:
    def __init__(self, project_path):
        self.project_path = Path(project_path).resolve()
        self.project_name = self.project_path.name
        self.data = {"name": self.project_name, "type": "Project", "children": []}

    def parse_file(self, file_path):
        children = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                lines = content.splitlines()
                
                if file_path.suffix == '.py':
                    for i, line in enumerate(lines):
                        cls_match = re.match(r'^class\s+(\w+)', line)
                        if cls_match:
                            children.append({"name": cls_match.group(1), "type": "Class", "line": i+1})
                        fn_match = re.match(r'^def\s+(\w+)', line)
                        if fn_match:
                            children.append({"name": fn_match.group(1), "type": "Function", "line": i+1})
                elif file_path.suffix in ['.js', '.ts', '.jsx', '.tsx']:
                    for i, line in enumerate(lines):
                        fn_match = re.search(r'function\s+(\w+)', line)
                        if fn_match:
                            children.append({"name": fn_match.group(1), "type": "Function", "line": i+1})
                        arrow_match = re.search(r'(const|let|var)\s+(\w+)\s*=\s*(async\s*)?\(', line)
                        if arrow_match:
                            children.append({"name": arrow_match.group(2), "type": "ArrowFunction", "line": i+1})
                        cls_match = re.search(r'class\s+(\w+)', line)
                        if cls_match:
                            children.append({"name": cls_match.group(1), "type": "Class", "line": i+1})
        except: pass
        return children

    def build_tree(self):
        def _explore(current_path, depth=0):
            if depth > 2: return [] # Shallow for speed
            nodes = []
            try:
                for entry in sorted(os.scandir(current_path), key=lambda e: e.name):
                    if entry.name.startswith('.') or entry.name in ['node_modules', '__pycache__', 'tests', 'docs']:
                        continue
                    if entry.is_dir():
                        subdir_children = _explore(entry.path, depth + 1)
                        if subdir_children:
                            nodes.append({"name": entry.name, "type": "Folder", "children": subdir_children})
                    elif entry.is_file():
                        ext = Path(entry.path).suffix
                        if ext in ['.py', '.js', '.ts']:
                            nodes.append({"name": entry.name, "type": "File"})
            except: pass
            return nodes
        self.data["children"] = _explore(self.project_path)
        return self.data

    def run_security_scan(self):
        issues = []
        python_files = list(self.project_path.glob('**/*.py'))
        for py_file in python_files[:100]:
            try:
                with open(py_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if 'eval(' in content:
                        issues.append({"severity": "MEDIUM", "file": str(py_file.relative_to(self.project_path)), "message": "eval() usage"})
                    if 'pickle.loads(' in content:
                        issues.append({"severity": "HIGH", "file": str(py_file.relative_to(self.project_path)), "message": "Insecure pickle.loads()"})
                    if 'yaml.load(' in content and 'FullLoader' not in content:
                        issues.append({"severity": "MEDIUM", "file": str(py_file.relative_to(self.project_path)), "message": "Insecure yaml.load()"})
            except: pass

        js_files = list(self.project_path.glob('**/*.js'))
        for js_file in js_files[:100]:
            try:
                with open(js_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if 'eval(' in content:
                        issues.append({"severity": "MEDIUM", "file": str(js_file.relative_to(self.project_path)), "message": "eval() usage"})
                    if 'innerHTML =' in content:
                        issues.append({"severity": "LOW", "file": str(js_file.relative_to(self.project_path)), "message": "Potential XSS via innerHTML"})
            except: pass
        return issues

def generate_report():
    homework_dir = Path("/Users/mac/Documents/GitHub/one-touch-map/homework")
    projects = [d for d in homework_dir.iterdir() if d.is_dir()]
    
    final_report = "# 🚀 Omega Engine: Multi-Project Security Audit Report\n\n"
    final_report += "This report summarizes the analysis of 5 major open-source projects.\n\n"
    
    all_issues = []

    for project in projects:
        analyzer = OmegaAnalyzer(project)
        print(f"Auditing {project.name}...")
        analyzer.build_tree()
        issues = analyzer.run_security_scan()
        
        final_report += f"## 📁 Project: {project.name}\n"
        final_report += f"- **Path:** `{project}`\n"
        final_report += f"- **Issues Found:** {len(issues)}\n\n"
        
        if issues:
            final_report += "| Severity | File | Message |\n"
            final_report += "|----------|------|---------|\n"
            for issue in issues[:10]: # Top 10
                final_report += f"| {issue['severity']} | `{issue['file']}` | {issue['message']} |\n"
                all_issues.append({"project": project.name, **issue})
            final_report += "\n"
        else:
            final_report += "✅ No major security patterns detected in sampled files.\n\n"

    with open(homework_dir / "REPORT.md", "w") as f:
        f.write(final_report)
    print("Final report generated: REPORT.md")

if __name__ == "__main__":
    generate_report()
