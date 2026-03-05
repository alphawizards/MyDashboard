import os

directory = r'C:\Users\ckr_4\OneDrive\Investing\01 Quallamaggie\backtesting'

for root, _, files in os.walk(directory):
    for f in files:
        if f.endswith('.py') and f != 'fix_quotes.py':
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
                
            # The literal string we accidentally wrote is \"\"\"
            target = '\\"\\"\\"'
            replacement = '"""'
            if target in content:
                content = content.replace(target, replacement)
                with open(path, 'w', encoding='utf-8') as out_file:
                    out_file.write(content)
                print(f"Fixed {path}")
