export type FileStatus = "added" | "modified" | "deleted" | "renamed";

interface Badge {
  label: string;
  color: string;
}

export function getStatusBadge(
  status: FileStatus,
  colors: { added: string; deleted: string; modified: string },
): Badge {
  switch (status) {
    case "added":
      return { label: "+", color: colors.added };
    case "deleted":
      return { label: "-", color: colors.deleted };
    case "renamed":
      return { label: "→", color: colors.modified };
    case "modified":
      return { label: "•", color: colors.modified };
  }
}
