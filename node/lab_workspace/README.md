# Lab Workspace (sandbox)

This directory is the **only** location the `list_lab_directory` plugin is allowed to
read. Path traversal outside this folder is rejected by design.

Drop harmless sample files here to make the *Directory Audit* mission more interesting
during a demo, e.g.:

```
lab_workspace/
├── README.md
├── sample-report.txt
└── notes/
    └── todo.txt
```

Nothing in this folder is executed. It exists purely so nodes have a safe, bounded
directory to enumerate.
