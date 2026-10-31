# Text Editor

Edit plain text files with shared drafts, find, line numbers, and revision-checked Save and Save As.

## Install

Requires a running [Ink OS](https://github.com/siliconjungle/ink-os-platform) instance and its `ink-os` CLI. Use Node.js 24 or later for development.

```sh
git clone https://github.com/siliconjungle/ink-app-text-editor.git
cd ink-app-text-editor
# Select your Ink instance using its CLI connection profile.
ink-os deploy .
```

The CLI deploys committed source from your checkout. Commit any edits before deploying them. No credentials or personal instance configuration belong in this repository.

## Behaviour and limits

Drafts use collaborative text documents; file saves remain explicit. File HTML is never executed.

## License

MIT for app code. Bundled third-party components retain their own licenses and notices.
