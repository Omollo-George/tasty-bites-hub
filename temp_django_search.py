import pathlib
import re
import django
root = pathlib.Path(django.__file__).resolve().parent
print('DJANGO ROOT:', root)
patterns = [re.compile(r'unsupported column constraint', re.I), re.compile(r'unsupported.*constraint', re.I), re.compile(r'column constraint', re.I)]
count = 0
for p in root.rglob('*.py'):
    try:
        txt = p.read_text(errors='ignore')
    except Exception:
        continue
    for pat in patterns:
        if pat.search(txt):
            print('\nFOUND', p)
            for i, line in enumerate(txt.splitlines(), 1):
                if pat.search(line):
                    start = max(1, i-3)
                    end = min(len(txt.splitlines()), i+3)
                    for j in range(start, end+1):
                        print(f'{j}:', txt.splitlines()[j-1])
                    break
            count += 1
            break
print('\nTOTAL matches:', count)
