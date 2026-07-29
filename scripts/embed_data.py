
import json
import os

html_path = 'omega_mindmap.html'
json_path = 'mindmap_data.json'

with open(json_path, 'r', encoding='utf-8') as f:
    json_content = f.read()

with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Replace the placeholder with actual data
target_str = "const treeData = {};"
replacement = f"const treeData = {json_content};"

new_html = html_content.replace(target_str, replacement)

# Remove the fetch logic since we embedded the data
# We can just leave it, it might fail but treeData is already init. 
# But initTree(data) is called in fetch. We need to call it manually.

# Let's modify the script part to call initTree immediately if data is present
# Find the fetch block and comment it out or replace it.
fetch_block_start = "fetch('mindmap_data.json')"
if fetch_block_start in new_html:
    # We will simply append the init call after the treeData definition
    # actually, the previous replacement put treeData in the global scope (or script scope)
    # The original HTML had:
    # <script id="treeDataScript">
    #    // Placeholder for injected data
    #    const treeData = {}; 
    # </script>
    # ...
    # <script>
    # ...
    # fetch(...)
    
    # We replaced const treeData = {} with the json.
    # Now we need to trigger initTree(treeData) at the end of the main script, and remove the fetch.
    
    new_html = new_html.replace("fetch('mindmap_data.json')", "// fetch('mindmap_data.json')")
    new_html = new_html.replace(".then(response => response.json())", "// .then(response => response.json())")
    new_html = new_html.replace(".then(data => initTree(data))", "// .then(data => initTree(data))")
    new_html = new_html.replace(".catch(err => console.error(\"Failed to load mindmap data\", err));", "initTree(treeData);")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Successfully embedded JSON data into HTML.")
