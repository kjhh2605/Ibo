"""Export a stable OpenAPI document without connecting to any services."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import create_app

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
args.output.write_text(json.dumps(create_app().openapi(), indent=2, sort_keys=True, ensure_ascii=False) + '\n', encoding='utf-8')
