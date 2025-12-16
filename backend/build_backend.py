#!/usr/bin/env python3
"""
Build script for creating a standalone backend executable using PyInstaller.

This script:
1. Checks for PyInstaller installation
2. Builds the backend using the backend.spec file
3. Verifies the build output
4. Provides instructions for testing

Usage:
    python build_backend.py
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path


def check_pyinstaller():
    """Check if PyInstaller is installed."""
    try:
        import PyInstaller
        print(f"✓ PyInstaller {PyInstaller.__version__} found")
        return True
    except ImportError:
        print("✗ PyInstaller not found")
        print("\nTo install PyInstaller, run:")
        print("  pip install pyinstaller")
        return False


def clean_build_dirs():
    """Clean previous build artifacts."""
    dirs_to_clean = ['build', 'dist']
    for dir_name in dirs_to_clean:
        dir_path = Path(dir_name)
        if dir_path.exists():
            print(f"Cleaning {dir_name}/...")
            shutil.rmtree(dir_path)
    print("✓ Build directories cleaned")


def build_backend():
    """Build the backend using PyInstaller."""
    print("\nBuilding backend executable...")
    print("This may take several minutes...\n")
    
    try:
        result = subprocess.run(
            ['pyinstaller', 'backend.spec', '--clean'],
            check=True,
            capture_output=True,
            text=True
        )
        print(result.stdout)
        print("✓ Build completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print("✗ Build failed")
        print("\nError output:")
        print(e.stderr)
        return False


def verify_build():
    """Verify the build output."""
    backend_dir = Path('dist/backend')
    
    if not backend_dir.exists():
        print("✗ Build directory not found")
        return False
    
    # Check for executable
    if sys.platform == 'win32':
        exe_name = 'backend.exe'
    else:
        exe_name = 'backend'
    
    exe_path = backend_dir / exe_name
    if not exe_path.exists():
        print(f"✗ Executable not found: {exe_path}")
        return False
    
    print(f"✓ Executable found: {exe_path}")
    
    # Get size information
    size_mb = exe_path.stat().st_size / (1024 * 1024)
    print(f"  Size: {size_mb:.2f} MB")
    
    # Count files in dist
    file_count = sum(1 for _ in backend_dir.rglob('*') if _.is_file())
    print(f"  Total files in bundle: {file_count}")
    
    return True


def print_instructions():
    """Print testing instructions."""
    print("\n" + "="*60)
    print("BUILD SUCCESSFUL")
    print("="*60)
    print("\nThe backend executable is located at:")
    print("  dist/backend/backend.exe (Windows)")
    print("  dist/backend/backend (macOS/Linux)")
    print("\nTo test the backend:")
    print("  1. Navigate to dist/backend/")
    print("  2. Run the executable:")
    if sys.platform == 'win32':
        print("     .\\backend.exe")
    else:
        print("     ./backend")
    print("  3. The server should start on http://localhost:8000")
    print("  4. Test the health endpoint:")
    print("     curl http://localhost:8000/health")
    print("\nNote: You'll need to set environment variables for API keys:")
    print("  - ANTHROPIC_API_KEY")
    print("  - OPENAI_API_KEY")
    print("  - GEMINI_API_KEY")
    print("\nFor Electron integration, copy the entire dist/backend/")
    print("directory to electron/resources/backend/")
    print("="*60)


def main():
    """Main build process."""
    print("="*60)
    print("FlashLearn Backend Build Script")
    print("="*60)
    
    # Check prerequisites
    if not check_pyinstaller():
        sys.exit(1)
    
    # Confirm build
    print("\nThis will build a standalone backend executable.")
    response = input("Continue? (y/n): ").strip().lower()
    if response != 'y':
        print("Build cancelled")
        sys.exit(0)
    
    # Clean previous builds
    clean_build_dirs()
    
    # Build
    if not build_backend():
        sys.exit(1)
    
    # Verify
    if not verify_build():
        sys.exit(1)
    
    # Print instructions
    print_instructions()


if __name__ == '__main__':
    main()
