# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for bundling the FlashLearn backend.

This spec file configures PyInstaller to create a standalone executable
that includes the FastAPI backend, all dependencies, and required data files.

Usage:
    pyinstaller backend.spec

Output:
    dist/backend/backend.exe (Windows)
    dist/backend/backend (macOS/Linux)
"""

import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect all submodules for packages that use dynamic imports
hiddenimports = [
    # FastAPI and dependencies
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'fastapi',
    'fastapi.routing',
    'fastapi.middleware',
    'fastapi.middleware.cors',
    'starlette',
    'starlette.middleware',
    'starlette.middleware.cors',
    'starlette.routing',
    'pydantic',
    'pydantic_settings',
    'pydantic.deprecated',
    'pydantic.deprecated.decorator',
    
    # SQLAlchemy
    'sqlalchemy',
    'sqlalchemy.ext',
    'sqlalchemy.ext.declarative',
    'sqlalchemy.orm',
    'sqlalchemy.sql',
    'sqlalchemy.sql.default_comparator',
    'sqlalchemy.dialects',
    'sqlalchemy.dialects.sqlite',
    
    # Document parsers
    'pdfplumber',
    'pdfplumber.utils',
    'pypdf',
    'PIL',
    'PIL._imaging',
    'docx',
    'docx.oxml',
    'docx.oxml.ns',
    'bs4',
    'lxml',
    'lxml.etree',
    'lxml._elementpath',
    'markdown',
    'pptx',
    'pptx.oxml',
    'youtube_transcript_api',
    
    # AI providers
    'anthropic',
    'openai',
    'openai.types',
    'openai.types.chat',
    'google.generativeai',
    'google.ai',
    'google.ai.generativelanguage',
    
    # Utilities
    'structlog',
    'prometheus_client',
    'prometheus_client.core',
    'prometheus_client.registry',
    'genanki',
    'dotenv',
    
    # Standard library modules that might be missed
    'email',
    'email.mime',
    'email.mime.multipart',
    'email.mime.text',
    'email.mime.base',
    'encodings',
    'encodings.idna',
    'encodings.utf_8',
    'encodings.ascii',
    'encodings.latin_1',
]

# Collect data files for packages that need them
datas = []
datas += collect_data_files('pdfplumber')
datas += collect_data_files('certifi')
datas += collect_data_files('anthropic')
datas += collect_data_files('openai')

# Add the app directory as data
datas += [('app', 'app')]

# Binaries - empty for now, add if needed
binaries = []

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude test and development dependencies
        'pytest',
        'pytest_asyncio',
        'pytest_cov',
        'pytest_benchmark',
        'hypothesis',
        'black',
        'flake8',
        'isort',
        'mypy',
        'pre_commit',
        
        # Exclude unnecessary standard library modules
        'tkinter',
        'unittest',
        'test',
        'distutils',
        'setuptools',
        'pip',
        
        # Exclude documentation and examples
        'IPython',
        'jupyter',
        'notebook',
        
        # Exclude PyQt (pulled in by genanki but not needed for backend)
        'PyQt6',
        'PyQt6.QtCore',
        'PyQt6.QtGui',
        'PyQt6.QtWidgets',
        'PyQt6.QtWebEngineCore',
        'PyQt6.QtWebEngineWidgets',
        'PyQt6.QtWebChannel',
        'PyQt6.QtNetwork',
        'PyQt6.QtMultimedia',
        'PyQt6.QtPrintSupport',
        'PyQt6.QtDBus',
        'PyQt6.QtQml',
        'PyQt6.QtQuick',
        'PyQt6.QtQuickWidgets',
        'PyQt6.QtOpenGL',
        'PyQt6.QtPositioning',
        'PyQt5',
        
        # Exclude pandas (pulled in by some dependencies but not used)
        'pandas',
        'pandas.io',
        'pandas.plotting',
        
        # Exclude scipy (pulled in by some dependencies but not used)
        'scipy',
        'scipy.spatial',
        'scipy.linalg',
        'scipy.special',
        'scipy.stats',
        
        # Exclude matplotlib (not used)
        'matplotlib',
        
        # Exclude numpy (if not actually used by our code)
        # Note: Some dependencies might need numpy, so test after excluding
        # 'numpy',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,  # Enable UPX compression
    console=True,  # Keep console for logging
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,  # Enable UPX compression
    upx_exclude=[],
    name='backend',
)
