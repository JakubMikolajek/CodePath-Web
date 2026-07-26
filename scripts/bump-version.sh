#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: bump-version.sh <major|minor|patch|X.Y.Z> [options]

Bumps the version in the root package.json and finalizes CHANGELOG.md's
"## [Unreleased]" section into a dated version heading.

Does NOT create a git commit or tag — that stays a manual, explicit step.

Changelog entries are written by hand under "## [Unreleased]" in
CHANGELOG.md as you go. The flags below are an optional shortcut to append
entries in the same command as the bump, filed under the matching Keep a
Changelog category:

  --added TEXT        (repeatable)
  --changed TEXT       (repeatable)
  --deprecated TEXT    (repeatable)
  --removed TEXT        (repeatable)
  --fixed TEXT          (repeatable)
  --security TEXT        (repeatable)

Refuses to cut a release if "## [Unreleased]" ends up with no entries at
all (neither pre-existing nor passed via flags) — an empty changelog
section for a version is almost always a mistake, not a deliberate choice.

Examples:
  bump-version.sh minor --added "callTargets/extendsTargets in ingest.v2"
  bump-version.sh 1.1.0
  bump-version.sh patch
USAGE
}

bump_kind=""
declare -a added=() changed=() deprecated=() removed=() fixed=() security=()

if [ "$#" -eq 0 ]; then
  usage >&2
  exit 1
fi

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
  usage
  exit 0
fi

bump_kind="$1"
shift

while [ "$#" -gt 0 ]; do
  case "$1" in
    --added) added+=("$2"); shift 2 ;;
    --changed) changed+=("$2"); shift 2 ;;
    --deprecated) deprecated+=("$2"); shift 2 ;;
    --removed) removed+=("$2"); shift 2 ;;
    --fixed) fixed+=("$2"); shift 2 ;;
    --security) security+=("$2"); shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
package_json="$repo_root/package.json"
changelog="$repo_root/CHANGELOG.md"

current_version="$(grep -m1 '"version"' "$package_json" | sed -E 's/.*"version":[[:space:]]*"([^"]+)".*/\1/')"

if [ -z "$current_version" ]; then
  echo "error: could not read current version from $package_json" >&2
  exit 1
fi

case "$bump_kind" in
  major|minor|patch) ;;
  [0-9]*.[0-9]*.[0-9]*) ;;
  *)
    echo "error: first argument must be 'major', 'minor', 'patch', or an explicit X.Y.Z version" >&2
    usage >&2
    exit 1
    ;;
esac

new_version="$(CURRENT="$current_version" KIND="$bump_kind" python3 -c '
import os

current = os.environ["CURRENT"]
kind = os.environ["KIND"]

if kind in ("major", "minor", "patch"):
    major, minor, patch = (int(part) for part in current.split("."))
    if kind == "major":
        major, minor, patch = major + 1, 0, 0
    elif kind == "minor":
        minor, patch = minor + 1, 0
    else:
        patch += 1
    print(f"{major}.{minor}.{patch}")
else:
    print(kind)
')"

echo "Bumping version: $current_version -> $new_version"

REPO_ROOT="$repo_root" \
PACKAGE_JSON="$package_json" \
CHANGELOG="$changelog" \
CURRENT_VERSION="$current_version" \
NEW_VERSION="$new_version" \
RELEASE_DATE="$(date -u +%Y-%m-%d)" \
ADDED="$(printf '%s\n' "${added[@]+"${added[@]}"}")" \
CHANGED="$(printf '%s\n' "${changed[@]+"${changed[@]}"}")" \
DEPRECATED="$(printf '%s\n' "${deprecated[@]+"${deprecated[@]}"}")" \
REMOVED="$(printf '%s\n' "${removed[@]+"${removed[@]}"}")" \
FIXED="$(printf '%s\n' "${fixed[@]+"${fixed[@]}"}")" \
SECURITY="$(printf '%s\n' "${security[@]+"${security[@]}"}")" \
python3 -c '
import os
import re
import sys

CATEGORY_ORDER = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"]

def entries_from_env(name):
    raw = os.environ.get(name, "")
    return [line for line in raw.split("\n") if line.strip()]

entries_by_category = {
    "Added": entries_from_env("ADDED"),
    "Changed": entries_from_env("CHANGED"),
    "Deprecated": entries_from_env("DEPRECATED"),
    "Removed": entries_from_env("REMOVED"),
    "Fixed": entries_from_env("FIXED"),
    "Security": entries_from_env("SECURITY"),
}

changelog_path = os.environ["CHANGELOG"]
new_version = os.environ["NEW_VERSION"]
release_date = os.environ["RELEASE_DATE"]

BOILERPLATE = """# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]
"""

if not os.path.exists(changelog_path):
    with open(changelog_path, "w", encoding="utf-8") as handle:
        handle.write(BOILERPLATE)

with open(changelog_path, "r", encoding="utf-8") as handle:
    text = handle.read()

unreleased_match = re.search(r"^## \[Unreleased\]\s*$", text, re.MULTILINE)
if not unreleased_match:
    print("error: CHANGELOG.md has no \"## [Unreleased]\" section — add one and try again.", file=sys.stderr)
    sys.exit(1)

section_start = unreleased_match.end()
next_heading = re.search(r"^## \[", text[section_start:], re.MULTILINE)
section_end = section_start + next_heading.start() if next_heading else len(text)
section = text[section_start:section_end]

for category in CATEGORY_ORDER:
    new_entries = entries_by_category[category]
    if not new_entries:
        continue

    bullet_lines = "".join(f"- {entry}\n" for entry in new_entries)
    subheading_pattern = re.compile(rf"^### {category}\s*$", re.MULTILINE)
    existing = subheading_pattern.search(section)

    if existing:
        insert_at = existing.end()
        rest = section[insert_at:]
        next_sub = re.search(r"^### ", rest, re.MULTILINE)
        block_end = insert_at + (next_sub.start() if next_sub else len(rest))
        section = section[:block_end].rstrip("\n") + "\n" + bullet_lines + section[block_end:]
    else:
        insertion_point = len(section)
        for later_category in CATEGORY_ORDER[CATEGORY_ORDER.index(category) + 1:]:
            later_match = re.search(rf"^### {later_category}\s*$", section, re.MULTILINE)
            if later_match:
                insertion_point = later_match.start()
                break
        block = f"\n### {category}\n\n{bullet_lines}"
        section = section[:insertion_point] + block + section[insertion_point:]

has_any_bullet = bool(re.search(r"^- ", section, re.MULTILINE))
if not has_any_bullet:
    print("error: \"## [Unreleased]\" has no entries (none in the file, none passed via --added/--fixed/etc). Refusing to cut an empty release.", file=sys.stderr)
    sys.exit(1)

section = re.sub(r"\n{3,}", "\n\n", section).strip("\n") + "\n\n"

versioned_heading = f"## [{new_version}] - {release_date}"
new_unreleased_and_versioned = "## [Unreleased]\n\n" + versioned_heading + "\n\n" + section

text = text[:unreleased_match.start()] + new_unreleased_and_versioned + text[section_end:]

with open(changelog_path, "w", encoding="utf-8") as handle:
    handle.write(text)

current_version = os.environ["CURRENT_VERSION"]

package_json_path = os.environ["PACKAGE_JSON"]
with open(package_json_path, "r", encoding="utf-8") as handle:
    content = handle.read()

updated, count = re.subn(
    r"(\"version\":\s*)\"" + re.escape(current_version) + r"\"",
    r"\g<1>" + f"\"{new_version}\"",
    content,
    count=1,
)
if count != 1:
    print(f"error: could not find \"version\": \"{current_version}\" in {package_json_path}", file=sys.stderr)
    sys.exit(1)

with open(package_json_path, "w", encoding="utf-8") as handle:
    handle.write(updated)

repo_root_path = os.environ["REPO_ROOT"]
updated_paths = [
    "CHANGELOG.md",
    os.path.relpath(os.environ["PACKAGE_JSON"], repo_root_path),
]
print("Updated " + ", ".join(updated_paths))
'

echo ""
echo "Done. Nothing was committed or tagged — review the diff, then commit when ready:"
echo "  git diff CHANGELOG.md package.json"
