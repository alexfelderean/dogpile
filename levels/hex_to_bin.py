import sys

# Ultra-Compact Level Data Generator
# Format: 162 bytes total = 81 height bytes + 81 entity bytes
#
# Input format: HEIGHT_DATA ENTITY_DATA OUTPUT_FILE
# HEIGHT_DATA: 81 hex bytes (2 chars each) for height map, or use 'z' for all zeros
# ENTITY_DATA: Sparse format 'NNE NNE ...' where NN=index (00-80), E=entity type
# OUTPUT_FILE: filename to write (avoids PowerShell encoding issues)
#
# Entity types:
#   s = spawn (value 1)
#   p = pressure plate + channel (p0-pf for channels 0-15)
#   d = door + channel (d0-df for channels 0-15)  
#   i = piston + channel (i0-if for channels 0-15)
#
# Examples:
#   python hex_to_bin.py z "40s 10p0 70d0" l1
#   (all zero heights, spawn at 40, plate at 10 channel 0, door at 70 channel 0)

def parse_entity(entity_str):
    """Parse an entity string like 's', 'p0', 'd1', 'i2'"""
    if len(entity_str) == 0:
        return 0
    
    etype = entity_str[0].lower()
    channel = 0
    if len(entity_str) > 1:
        channel = int(entity_str[1], 16)  # hex digit 0-f
    
    if etype == 's':
        # Spawn: value 1-15 (we use 1 for default)
        return 1
    elif etype == 'p':
        # Pressure plate: 16 + channel
        return 16 + channel
    elif etype == 'd':
        # Door mechanism: 128 + (type 0 << 4) + channel = 128 + channel
        return 128 + channel
    elif etype == 'i':
        # Piston mechanism: 128 + (type 1 << 4) + channel = 144 + channel
        return 144 + channel
    elif etype == 'a':
        # Arrow: value 32
        return 32
    else:
        sys.stderr.write(f"Unknown entity type: {etype}\n")
        return 0

def main():
    if len(sys.argv) < 4:
        sys.stderr.write("Usage: python hex_to_bin.py <height_data> <entity_data> <output_file>\n")
        sys.stderr.write("  height_data: 'z' for all zeros, or 162 hex chars (81 bytes)\n")
        sys.stderr.write("  entity_data: space-separated 'NNE' entries (NN=index, E=type)\n")
        sys.stderr.write("  output_file: binary file to write\n")
        sys.stderr.write("\nEntity types: s=spawn, p0-pf=plate, d0-df=door, i0-if=piston\n")
        sys.stderr.write("Example: python hex_to_bin.py z \"40s 10p0 70d0\" l1\n")
        sys.exit(1)

    height_arg = sys.argv[1].strip()
    entity_arg = sys.argv[2].strip()
    output_file = sys.argv[3].strip()

    result = bytearray(162)  # 81 height + 81 entity bytes

    # Parse height data
    if height_arg.lower() == 'z':
        # All zeros (already initialized)
        pass
    else:
        # Parse as hex string
        height_hex = height_arg.replace(" ", "")
        if len(height_hex) >= 162:
            for i in range(81):
                result[i] = int(height_hex[i*2:i*2+2], 16)
        else:
            sys.stderr.write(f"Warning: Height data too short ({len(height_hex)} chars, need 162)\n")

    # Parse entity data
    if entity_arg:
        entries = entity_arg.split()
        for entry in entries:
            if len(entry) < 3:
                continue
            try:
                index = int(entry[:2])
                entity_type = entry[2:]
                if 0 <= index < 81:
                    result[81 + index] = parse_entity(entity_type)
            except ValueError as e:
                sys.stderr.write(f"Error parsing entry '{entry}': {e}\n")

    # Write to file (binary mode)
    with open(output_file, 'wb') as f:
        f.write(result)
    
    print(f"Wrote {len(result)} bytes to {output_file}")

if __name__ == "__main__":
    main()