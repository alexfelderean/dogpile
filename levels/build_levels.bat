@echo off
REM =====================================================
REM Level Build Script for Dogpile
REM =====================================================
REM
REM Entity format: NNE where NN=index (00-80), E=type
REM   s   = spawn
REM   p0-pf = pressure plate (channel 0-15)
REM   d0-df = door (channel 0-15)
REM   i0-if = piston (channel 0-15)
REM
REM Height: 'z' for all zeros, or 162 hex chars
REM =====================================================

echo Building levels...

REM Level 1: Simple door puzzle
REM - Spawn at center (40)
REM - Pressure plate at index 10 (top-left area), channel 0
REM - Door at index 70 (bottom-right area), channel 0
python hex_to_bin.py z "40s 10p0 70d0 02a" l1
echo L1: spawn=40, plate@10(ch0), door@70(ch0), arrow@01

REM Level 2: Stairs to the door
REM - Stairs on right wall going from bottom (height 0) to top (height 5)
REM - Spawn at bottom-left (72)
REM - Pressure plate at bottom-center (76), channel 0
REM - Door at top-right corner (08), channel 0
python hex_to_bin.py "000000000000000405000000000000000405000000000000000304000000000000000304000000000000000203000000000000000203000000000000000102000000000000000102000000000000000001" "72s 76p0 08d0" l2
echo L2: stairs on right, spawn@72, plate@76(ch0), door@08(ch0)

echo.
echo Done! Levels written to l1, l2
echo.
echo Grid layout (9x9):
echo   00 01 02 03 04 05 06 07 08
echo   09 10 11 12 13 14 15 16 17
echo   18 19 20 21 22 23 24 25 26
echo   27 28 29 30 31 32 33 34 35
echo   36 37 38 39 40 41 42 43 44
echo   45 46 47 48 49 50 51 52 53
echo   54 55 56 57 58 59 60 61 62
echo   63 64 65 66 67 68 69 70 71
echo   72 73 74 75 76 77 78 79 80
