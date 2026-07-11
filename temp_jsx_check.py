from pathlib import Path
from collections import deque

path = Path('frontend/src/pages/Admin/EmployeeTable.tsx')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
stack = []
errors = []
for lineno, line in enumerate(lines, start=1):
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == '"' or ch == "'":
            quote = ch
            i += 1
            while i < len(line) and line[i] != quote:
                if line[i] == '\\':
                    i += 2
                    continue
                i += 1
        elif line[i:i+2] == '//':
            break
        elif line[i:i+2] == '/*':
            idx = line.find('*/', i+2)
            if idx == -1:
                break
            i = idx + 2
            continue
        elif line.startswith('<>', i):
            stack.append(('fragment', lineno))
            i += 2
            continue
        elif line.startswith('</>', i):
            if not stack or stack[-1][0] != 'fragment':
                errors.append((lineno, 'unexpected fragment close'))
            else:
                stack.pop()
            i += 3
            continue
        elif line.startswith('<div', i) and (i+4 == len(line) or line[i+4].isspace() or line[i+4] in ['>', '/']):
            stack.append(('div', lineno))
            i += 4
            continue
        elif line.startswith('</div>', i):
            if not stack or stack[-1][0] != 'div':
                errors.append((lineno, 'unexpected div close'))
            else:
                stack.pop()
            i += 6
            continue
        else:
            i += 1

print('errors:', errors)
print('remaining stack length:', len(stack))
for item in stack[-20:]:
    print(item)
print('line 569-575')
for j in range(568, 575):
    print(j+1, lines[j])
print('line 844-851')
for j in range(843, 851):
    print(j+1, lines[j])
