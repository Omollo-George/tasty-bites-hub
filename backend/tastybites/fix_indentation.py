#!/usr/bin/env python
# Fix indentation in _ensure_required_tables function
import sys

file_path = 'payments/views.py'

with open(file_path, 'rb') as f:
    content = f.read().decode('utf-8', errors='replace')

lines = content.split('\n')

# Find the function start and fix indentation
fixing = False
fixed_lines = []

for i, line in enumerate(lines, 1):
    if 'def _ensure_required_tables() -> bool:' in line:
        fixing = True
        fixed_lines.append(line)
        continue
    
    if fixing and i > 169 and i <= 620:  # Lines that need fixing
        # If line starts with 4 spaces (top-level if/try), add 4 more spaces
        if line.startswith('    ') and not line.startswith('        '):
            if line.strip() and not line.strip().startswith('#'):
                line = '    ' + line
    
    fixed_lines.append(line)
    
    # Stop fixing after the function
    if fixing and i > 620 and 'def ' in line and 'def _ensure_required_tables' not in line:
        fixing = False

fixed_content = '\n'.join(fixed_lines)

with open(file_path, 'wb') as f:
    f.write(fixed_content.encode('utf-8'))

print("✓ Fixed indentation in _ensure_required_tables")
