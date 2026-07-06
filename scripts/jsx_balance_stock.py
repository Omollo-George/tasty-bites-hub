from pathlib import Path
import re

path = Path('frontend/src/pages/Admin/Stock.tsx')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()

self_closing = {
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
    'option', 'path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'stop', 'use', 'text',
    'Search', 'Plus', 'AlertTriangle', 'CheckCircle', 'XCircle', 'Trash2', 'Edit2', 'textarea'
}

stack = []
for i, line in enumerate(lines, start=1):
    for m in re.finditer(r'<\s*(/)?\s*([A-Za-z][A-Za-z0-9_\-:\.]*)[^>]*>', line):
        closing = bool(m.group(1))
        tag = m.group(2)
        if tag == 'React.Fragment':
            continue
        if closing:
            if stack and stack[-1][0] == tag:
                stack.pop()
            else:
                print(f'BAD_CLOSE {tag} at {i}:{m.start()+1} stack={[x[0] for x in stack]})')
                if stack:
                    stack.pop()
        else:
            text_after = line[m.end()-2:m.end()]
            if text_after == '/>' or tag in self_closing:
                continue
            stack.append((tag, i, m.start()+1))

print('FINAL_STACK')
for tag, line_num, col in stack:
    print(f'{tag} opened at {line_num}:{col}')
print('DIV_DIFF', text.count('<div') - text.count('</div>'))
