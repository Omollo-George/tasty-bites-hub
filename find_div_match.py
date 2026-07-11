from pathlib import Path
text = Path('frontend/src/pages/Admin/EmployeeTable.tsx').read_text(encoding='utf-8')
start_marker = '<div className="space-y-8">'
pos = text.find(start_marker)
print('start pos', pos)
if pos==-1:
    print('marker not found')
else:
    i = pos
    count = 0
    while i < len(text):
        if text.startswith('<div', i):
            count += 1
            i += 4
            continue
        if text.startswith('</div>', i):
            count -= 1
            i += 6
            if count==0:
                # found matching close; print context
                snippet_start = max(0, i-120)
                snippet_end = min(len(text), i+120)
                print('match at index', i)
                print(text[snippet_start:snippet_end])
                break
        i += 1
    print('final count', count)
