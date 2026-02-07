import sys

# Custom Level Parser
# Format: NN L NN L ...
# NN = 2-digit Index (Decimal, 00-81)
# L  = 1-char Type (Hex, a, b, c...)
# Example: 00a13b -> Index 0, Type A; Index 13, Type B

def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python hex_to_bin.py <string>\n")
        sys.exit(1)

    s = sys.argv[1].replace(" ", "").strip()
    
    # Process in chunks of 3
    result = bytearray()
    
    i = 0
    while i < len(s):
        # Allow trailing characters to be ignored if incomplete
        if i + 2 >= len(s):
            break
            
        index_str = s[i:i+2]
        type_str = s[i+2]
        
        try:
            # Parse Index as Decimal (per "13b -> 13" instruction)
            index = int(index_str) 
            
            # Parse Type as Hex
            type_val = int(type_str, 16)
            
            result.append(index)
            result.append(type_val)
            
        except ValueError:
            sys.stderr.write(f"Error parsing chunk '{s[i:i+3]}'\n")
            sys.exit(1)
            
        i += 3

    sys.stdout.buffer.write(result)

if __name__ == "__main__":
    main()