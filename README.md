# GitHub README Beautifier

Zero-dependency Node.js CLI tool that generates beautiful README.md from any GitHub repository.

## Features

- Fetch repo info via GitHub API (stars, language, license, topics)
- Auto-generate badges (license, stars, forks, issues, last commit)
- Auto-detect language and generate appropriate install/usage sections
- Display project directory tree structure
- 3 templates: standard, minimal, full
- Zero dependencies - only uses Node.js built-in modules
- Supports GitHub PAT for higher rate limits

## Installation

```bash
git clone https://github.com/user/readme-beautifier.git
cd readme-beautifier
chmod +x install.sh
./install.sh
```

## Usage

```bash
# Basic usage
node main.js https://github.com/user/repo

# Specify output file
node main.js user/repo --output README.md

# Use full template
node main.js user/repo --template full

# Use GitHub token for higher rate limits
node main.js user/repo --token ghp_your_token

# Dry run (print to console)
node main.js user/repo --dry-run
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| --output <path> | Output file path | ./README_GENERATED.md |
| --template <name> | standard, minimal, full | standard |
| --token <token> | GitHub PAT for higher limits | none |
| --no-badges | Skip badge generation | false |
| --no-tree | Skip directory tree | false |
| --dry-run | Print to console | false |

## License

MIT
