from pathlib import Path
import re

path = Path('frontend/src/pages/Admin/Stock.tsx')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()

# basic JSX-aware stack parser for tag nesting
self_closing = {
    'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr',
    'option','path','rect','circle','ellipse','line','polygon','polyline','stop','use','text',
    'Search','Plus','AlertTriangle','CheckCircle','XCircle','Trash2','Edit2','textarea'
}

stack = []
for i, line in enumerate(lines, start=1):
    for m in re.finditer(r'<\s*(/)?\s*([A-Za-z0-9_.:-]+)([^>]*)>', line):
        slash, tag, rest = m.group(1), m.group(2), m.group(3)
        closing = bool(slash)
        if tag == 'React.Fragment':
            continue
        if closing:
            if stack and stack[-1] == tag:
                stack.pop()
            else:
                print(f'MISMATCH_CLOSE {tag} at {i}:{m.start()+1} stack={stack}')
                if stack:
                    stack.pop()
        else:
            if rest.strip().endswith('/') or tag in self_closing:
                continue
            stack.append(tag)

print('FINAL_STACK', stack)
print('DIV_OPEN', text.count('<div'))
print('DIV_CLOSE', text.count('</div>'))
