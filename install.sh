#!/bin/bash
# GitHub README Beautifier - Install Script
set -e

echo "Installing README Beautifier..."
DIR="${HOME}/.readme-beautifier"
mkdir -p "$DIR"
cp main.js "$DIR/"

# Create global symlink
if [ -w /usr/local/bin ]; then
  ln -sf "$DIR/main.js" /usr/local/bin/readme-beautify
  echo "Installed to /usr/local/bin/readme-beautify"
else
  echo "Add to PATH: export PATH=\"$DIR:$PATH\""
  ln -sf "$DIR/main.js" "$DIR/readme-beautify"
fi

echo "Done! Usage: readme-beautify user/repo"
