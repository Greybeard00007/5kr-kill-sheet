#!/usr/bin/env python3
"""
Bundle builder script for 5KR Kill Sheet.
Embeds src/component.js into the template script within src/index.html
while preserving all bundle formatting and slash-escaping for HTML parsers.
"""

import json
import os
import re
import sys

def build():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    component_path = os.path.join(root, 'src', 'component.js')
    index_path = os.path.join(root, 'src', 'index.html')

    if not os.path.isfile(component_path):
        print(f"Error: {component_path} not found.", file=sys.stderr)
        sys.exit(1)
    if not os.path.isfile(index_path):
        print(f"Error: {index_path} not found.", file=sys.stderr)
        sys.exit(1)

    with open(component_path, 'r', encoding='utf-8') as f:
        component_code = f.read()

    with open(index_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Locate __bundler/template script tag
    open_tag = '<script type="__bundler/template">'
    idx = html.find(open_tag)
    if idx == -1:
        print("Error: <script type=\"__bundler/template\"> not found in index.html", file=sys.stderr)
        sys.exit(1)

    tag_start = idx + len(open_tag)
    end_idx = html.rfind('</script>')
    if end_idx <= tag_start:
        print("Error: Closing </script> tag not found after template opening tag", file=sys.stderr)
        sys.exit(1)

    raw_json = html[tag_start:end_idx].strip()
    try:
        template_str = json.loads(raw_json)
    except json.JSONDecodeError as e:
        print(f"Error decoding template JSON: {e}", file=sys.stderr)
        sys.exit(1)

    # Locate <script type="text/x-dc"...>...</script> inside the decoded template
    dc_m = re.search(r'(<script type=\"text/x-dc\"[^>]*>)(.*?)(</script>)', template_str, re.DOTALL)
    if not dc_m:
        print("Error: <script type=\"text/x-dc\"...> not found in template", file=sys.stderr)
        sys.exit(1)

    new_template_str = template_str[:dc_m.start(2)] + component_code + template_str[dc_m.end(2):]

    # Re-encode JSON, escaping '/' as '\u002F' to prevent HTML parsers from breaking on inner </script> tags
    new_json = json.dumps(new_template_str).replace('/', '\\u002F')

    new_html = html[:tag_start] + '\n' + new_json + '\n  ' + html[end_idx:]

    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(new_html)

    print(f"Successfully rebuilt {index_path} with {len(component_code)} bytes of component code.")

if __name__ == '__main__':
    build()
