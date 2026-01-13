from pathlib import Path
import sys
p=Path(r"c:/Users/gomez/.windsurf/proyecto valenciavguides/retos-hijo4.html")
s=p.read_text(encoding='utf-8')
start=s.find('<script type="module">')
end=s.find('</script>', start)
if start==-1 or end==-1:
    print('SCRIPT_BLOCK_NOT_FOUND')
    sys.exit(1)
block=s[start:end]
# Only check the script block
stack=[]
pairs={'(':')','{':'}','[':']'}
openers=set(pairs.keys())
closers=set(pairs.values())
line=1
col=0
errors=[]
for i,ch in enumerate(block):
    if ch=='\n':
        line+=1; col=0; continue
    col+=1
    if ch in openers:
        stack.append((ch,line,col,i))
    elif ch in closers:
        if not stack:
            errors.append((line,col,ch,'UNEXPECTED_CLOSER'))
        else:
            last, lline, lcol, idx = stack.pop()
            if pairs[last]!=ch:
                errors.append((line,col,ch,f'EXPECTED {pairs[last]} AFTER {last} AT {lline}:{lcol}'))
if stack:
    for last,lline,lcol,idx in stack:
        errors.append((lline,lcol,last,'UNMATCHED_OPENER'))
if errors:
    print('SYNTAX_ERRORS')
    for e in errors[:20]:
        print(e)
    sys.exit(2)
else:
    print('BRACES_OK')
    sys.exit(0)
