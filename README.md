# Download artifact GitHub Action v1.1.0

An action that downloads and extracts uploaded artifact by name. Download artifact from repository - it's not dependent by any workflow.

## What's new
Version 1.1.0 now supports Node 16.

## Usage

```yaml
- name: Download artifact
  uses: aochmann/actions-download-artifact@1.1.0
  with:
    # Optional, GitHub token
    github_token: ${{secrets.GITHUB_TOKEN}}

    # Optional, uploaded artifact name,
    # will download all artifacts if not specified
    # and extract them in respective subdirectories
    # https://github.com/actions/download-artifact#download-all-artifacts
    name: artifact_name

    # Optional, download latest artifact
    latest: true

    # Optional, directory where to extract artifact
    path: extract_here

    # Optional, defaults to current repo
    repo: ${{github.repository}}
```
