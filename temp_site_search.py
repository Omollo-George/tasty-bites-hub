import site
from pathlib import Path
import re
paths = []
for p in site.getsitepackages():
    if Path(p).exists():
        paths.append(Path(p))
try:
    users = site.getusersitepackages()
    if Path(users).exists():
        paths.append(Path(users))
except Exception:
    pass
paths = list(dict.fromkeys(paths))
print('search paths:')
for p in paths:
    print(' ', p)
pattern = re.compile(r'unsupported column constraint', re.I)
count = 0
for root in paths:
    for p in root.rglob('*.py'):
        try:
            txt = p.read_text(errors='ignore')
        except Exception:
            continue
        if pattern.search(txt):
            print('\nFOUND', p)
            for i, line in enumerate(txt.splitlines(), 1):
                if pattern.search(line):
                    print(i, line)
            count += 1
print('\nTOTAL', count)
