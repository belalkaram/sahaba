# R7 design codemod (OD-17) — raw numbers rendered in JSX text go through lib/format so they
# display with Arabic-Indic digits:   {x}%  -> {formatPercent(x)}    {list.length} -> {formatNumber(list.length)}
# Attribute values (key=, value=) and template literals are left untouched.
#   python -I scripts/design-codemods/codemod-numbers.py   (run from apps/web)
import os
import re

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src')
PCT = re.compile(r'([^$=\w])\{([A-Za-z_][^{}<>$`]{0,58}?)\}%')
LEN = re.compile(r'([>\s(])\{([A-Za-z_][^{}<>$`=]{0,58}\.length)\}')
IMPORT = re.compile(r"import \{([^}]*)\} from '([^']*lib/format)';")
ANY_IMPORT = re.compile(r"^import [\s\S]*?from ['\"][^'\"]+['\"];?\s*$", re.M)

changed = 0
for sub in ('app', 'features'):
    for dirpath, _, files in os.walk(os.path.join(SRC, sub)):
        for name in files:
            if not name.endswith('.tsx'):
                continue
            path = os.path.join(dirpath, name)
            src = open(path, encoding='utf-8').read()
            used = set()

            def pct(m):
                used.add('formatPercent')
                return m.group(1) + '{formatPercent(' + m.group(2) + ')}'

            def ln(m):
                used.add('formatNumber')
                return m.group(1) + '{formatNumber(' + m.group(2) + ')}'

            out = LEN.sub(ln, PCT.sub(pct, src))
            if out == src:
                continue
            existing = IMPORT.search(out)
            if existing:
                names = {n.strip() for n in existing.group(1).split(',') if n.strip()} | used
                out = out.replace(existing.group(0), "import { " + ', '.join(sorted(names)) + " } from '" + existing.group(2) + "';")
            else:
                rel = os.path.relpath(os.path.join(SRC, 'lib', 'format'), dirpath).replace(os.sep, '/')
                if not rel.startswith('.'):
                    rel = './' + rel
                last = list(ANY_IMPORT.finditer(out))[-1]
                out = out[: last.end()] + "\nimport { " + ', '.join(sorted(used)) + " } from '" + rel + "';" + out[last.end():]
            open(path, 'w', encoding='utf-8').write(out)
            changed += 1
print(f'{changed} files changed')
