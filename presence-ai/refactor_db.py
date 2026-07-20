import os
import re

def refactor_db():
    with open("backend/db.py", "r") as f:
        content = f.read()
    
    # We will use regex to find all functions that start with:
    # conn = get_connection()
    # and end with conn.close()
    
    def replacer(match):
        func_body = match.group(0)
        # Remove conn.commit() and conn.close()
        func_body = re.sub(r'^[ \t]*conn\.commit\(\)\n?', '', func_body, flags=re.MULTILINE)
        func_body = re.sub(r'^[ \t]*conn\.close\(\)\n?', '', func_body, flags=re.MULTILINE)
        
        # Replace conn = get_connection() with context manager
        lines = func_body.split('\n')
        out_lines = []
        for line in lines:
            if "conn = get_connection()" in line:
                indent = line[:line.find("conn")]
                out_lines.append(indent + "with contextlib.closing(get_connection()) as conn:")
                out_lines.append(indent + "    with conn:")
            elif line.strip() == "def init_db():":
                out_lines.append(line)
            else:
                if out_lines and "with contextlib" in "\n".join(out_lines[-2:]):
                    # For all subsequent lines in the function, indent them by 8 spaces
                    if line.strip():
                        out_lines.append("        " + line)
                    else:
                        out_lines.append(line)
                else:
                    out_lines.append(line)
        return "\n".join(out_lines)

    # Note: Regex replacing Python is dangerous, I will use a simple AST-based or careful line-by-line replacement manually if possible.
    
    # Actually, a safer way to prevent database locking without changing every function 
    # is to create a decorator!
    
    pass

refactor_db()
