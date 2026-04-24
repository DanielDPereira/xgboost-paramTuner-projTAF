import os

filepath = r"c:\Users\Daniel\Documents\.Projetos\xgboost-paramTuner-projTAF\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Find style block
style_start = content.find("<style>")
style_end = content.find("</style>") + len("</style>")
style_content = content[style_start + len("<style>"):content.find("</style>")].strip()

# Find main script block (ignoring the external scripts in head)
script_start = content.rfind("<script>")
script_end = content.rfind("</script>") + len("</script>")
script_content = content[script_start + len("<script>"):content.rfind("</script>")].strip()

# Replace in html
new_content = content[:style_start] + '<link rel="stylesheet" href="style.css">' + content[style_end:script_start] + '<script src="script.js"></script>' + content[script_end:]

with open(filepath, "w", encoding="utf-8") as f:
    f.write(new_content)

dir_path = os.path.dirname(filepath)
with open(os.path.join(dir_path, "style.css"), "w", encoding="utf-8") as f:
    f.write(style_content)

with open(os.path.join(dir_path, "script.js"), "w", encoding="utf-8") as f:
    f.write(script_content)

print("Split completed successfully!")
