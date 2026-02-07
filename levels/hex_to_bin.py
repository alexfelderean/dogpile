import sys

# Custom Level Parser
# Format:  
# 0/1 = 0 = door leftside, 1 = door rightside
# then first NN is spawn point index
# then infinite NN L ... repeat as needed
# NN = 2-digit Index (Decimal, 00-81)
# L  = 1-char Type (Hex, a, b, c...)
# Example call: python3 hex_to_bin.py 07200a08b80c > l1

def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python hex_to_bin.py <string>\n")
        sys.exit(1)

    s = sys.argv[1].replace(" ", "").strip()
    
    # Process Header
    # 1. Door Wall (1 char) -> 0 or 1
    # 2. Spawn Index (2 chars) -> Decimal 00-81
    
    if len(s) < 3:
        sys.stderr.write("Error: String too short for header (need at least 3 chars)\n")
        sys.exit(1)
        
    door_char = s[0]
    spawn_str = s[1:3]
    rest = s[3:]
    
    result = bytearray()
    
    try:
        # Parse Door
        door_val = int(door_char)
        result.append(door_val)
        
        # Parse Spawn
        spawn_val = int(spawn_str)
        result.append(spawn_val)
        
    except ValueError:
         sys.stderr.write("Error: Invalid header format\n")
         sys.exit(1)

    # Process Objects in chunks of 3
    i = 0
    while i < len(rest):
        # Allow trailing characters to be ignored if incomplete
        if i + 2 >= len(rest):
            break
            
        index_str = rest[i:i+2]
        type_str = rest[i+2]
        
        try:
            # Parse Index as Decimal
            index = int(index_str) 
            
            # Parse Type as Hex
            type_val = int(type_str, 16)
            
            result.append(index)
            result.append(type_val)
            
        except ValueError:
            sys.stderr.write(f"Error parsing chunk '{rest[i:i+3]}'\n")
            sys.exit(1)
            
        i += 3

    sys.stdout.buffer.write(result)

if __name__ == "__main__":
    main()