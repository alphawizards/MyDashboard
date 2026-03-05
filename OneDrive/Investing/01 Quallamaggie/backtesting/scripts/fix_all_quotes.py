import os
directory = r'C:\Users\ckr_4\OneDrive\Investing\01 Quallamaggie\backtesting\src'
for root, _, files in os.walk(directory):
    for f in files:
        if f.endswith('.py'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            target = '\\"'
            replacement = '"'
            if target in content:
                content = content.replace(target, replacement)
                with open(path, 'w', encoding='utf-8') as out_file:
                    out_file.write(content)
                print(f"Fixed quotes in {path}")
