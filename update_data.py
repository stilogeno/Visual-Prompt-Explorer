import json
import os
import re

# Resolve paths relative to this script, so it works from any working directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'app', 'data.js')

# Read the file
with open(DATA_FILE, 'r') as f:
    original_content = f.read()

# Parse the original content manually since it's not valid JSON
# Structure: const galleryData = [ { ... }, { ... }, ... ];

lines = original_content.split('\n')
in_array = False
in_object = False
stars_added = 0

result_lines = []
i = 0

while i < len(lines):
    line = lines[i]

    # Check if we're in the array
    if 'const galleryData = [' in line:
        in_array = True
        result_lines.append(line)
        i += 1
        continue

    if in_array:
        # Check if we're starting a new object
        if line.strip() == '{':
            in_object = True
            result_lines.append(line)
            i += 1
            continue

        # Check if we're ending an object (but not the end of array)
        if in_object and line.strip() == '}' and i + 1 < len(lines) and '];' not in lines[i + 1]:
            in_object = False
            result_lines.append(line)
            i += 1
            continue

        # Inside an object, look for "folder" field and add stars after it
        if in_object and '"folder"' in line and '"stars"' not in line:
            # Add stars field after the folder line
            result_lines.append(line)
            i += 1
            # Next line should be the closing brace
            if i < len(lines) and lines[i].strip() == '}':
                result_lines.append('        "stars": 0,')
                result_lines.append(lines[i])
                i += 1
                stars_added += 1
                continue

        result_lines.append(line)
        i += 1

# Write the modified content.
# NOTE: result_lines already contains the original "const galleryData = [" header
# and the closing "];" — do NOT prepend/append them again.
new_content = '\n'.join(result_lines) + '\n'

with open(DATA_FILE, 'w') as f:
    f.write(new_content)

print(f"Updated {stars_added} entries with stars field")
print(f"Original lines: {len(lines)}, Final lines: {len(new_content.split(chr(10)))}")