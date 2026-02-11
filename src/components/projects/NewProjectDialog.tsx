import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/stores/appStore";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewProjectDialog({ open, onOpenChange }: Props) {
  const createProject = useAppStore((s) => s.createProject);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);

  const [name, setName] = useState("");
  const canSubmit = useMemo(() => name.trim().length > 0 && !loading, [name, loading]);

  useEffect(() => {
    if (!open) setName("");
  }, [open]);

  const submit = async () => {
    if (!canSubmit) return;
    await createProject(name);
    const latestError = useAppStore.getState().error;
    if (!latestError) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Create a project to organize files and tables.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="text-[12px] text-muted-foreground">Project name</div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. E-Commerce Analytics"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
          {error && <div className="text-[12px] text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {loading ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

