import os
import json
import re
from pathlib import Path

class OmegaAutoFixer:
    def __init__(self, base_dir):
        self.base_dir = Path(base_dir).resolve()
        self.projects = [d for d in self.base_dir.iterdir() if d.is_dir() and d.name != 'omega_analyzer.py']
        self.report_entries = []

    def scan_and_fix(self, project_path):
        fixes_count = 0
        issues_found = []
        
        # Define patterns to search and fix
        # Pattern: (regex, replacement, description, severity)
        patterns = [
            (r'eval\(', '// OMEGA_SCAN: eval detected. Consider safe-eval or JSON.parse', 'Insecure eval usage', 'MEDIUM'),
            (r'\.innerHTML\s*=\s*', '.textContent = ', 'Potential XSS via innerHTML replaced with textContent', 'HIGH'),
            (r'shell=True', 'shell=False', 'Shell injection risk: shell=True set to False', 'HIGH'),
            (r'pickle\.loads\(', '# OMEGA_SCAN: Insecure pickle usage', 'Insecure pickle.loads detected', 'HIGH')
        ]

        for ext in ['*.py', '*.js']:
            for file_path in project_path.glob(f'**/{ext}'):
                if 'node_modules' in str(file_path) or '.git' in str(file_path):
                    continue
                
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = f.readlines()
                    
                    new_lines = []
                    file_fixed = False
                    for line in lines:
                        modified_line = line
                        for pattern, replacement, desc, sev in patterns:
                            if re.search(pattern, line):
                                issues_found.append({"file": str(file_path.relative_to(project_path)), "desc": desc, "sev": sev})
                                # For demonstration, we only auto-replace clear safety fixes like innerHTML or shell=True
                                if 'innerHTML' in pattern or 'shell=True' in pattern:
                                    modified_line = re.sub(pattern, replacement, modified_line)
                                    fixes_count += 1
                                    file_fixed = True
                        new_lines.append(modified_line)
                    
                    if file_fixed:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.writelines(new_lines)
                except: pass
        
        return issues_found, fixes_count

    def run(self):
        summary = "# 🚀 Omega Engine: Automated Security Audit & Auto-Fix Report\n\n"
        summary += "## 📊 Executive Summary\n"
        
        project_summaries = []
        
        for project in self.projects:
            print(f"Processing {project.name}...")
            issues, fixes = self.scan_and_fix(project)
            project_summaries.append({
                "name": project.name,
                "issues": len(issues),
                "fixes": fixes,
                "details": issues[:5] # Sample top 5
            })
        
        total_issues = sum(p['issues'] for p in project_summaries)
        total_fixes = sum(p['fixes'] for p in project_summaries)
        
        summary += f"- **Projects Audited:** {len(self.projects)}\n"
        summary += f"- **Total Vulnerabilities Detected:** {total_issues}\n"
        summary += f"- **Automatically Applied Fixes:** {total_fixes}\n\n"
        
        summary += "## 📁 Project Breakthrough\n\n"
        for p in project_summaries:
            summary += f"### 🔹 {p['name']}\n"
            summary += f"- **Issues Identified:** {p['issues']}\n"
            summary += f"- **Omega Auto-Fixes Applied:** {p['fixes']}\n"
            if p['details']:
                summary += "\n| Severity | File | Issue Description |\n"
                summary += "|----------|------|-------------------|\n"
                for detail in p['details']:
                    summary += f"| {detail['sev']} | `{detail['file']}` | {detail['desc']} |\n"
            summary += "\n---\n"
        
        summary += "\n\n**Note:** This is an automated report by Antigravity Omega Engine. High-severity fixes like `shell=True` and `innerHTML` were automatically applied. Other risks were documented for manual review.\n"
        
        with open(self.base_dir / "REPORT.md", "w", encoding="utf-8") as f:
            f.write(summary)
        
        print("Final Full Automation Report generated.")

if __name__ == "__main__":
    fixer = OmegaAutoFixer(".")
    fixer.run()
