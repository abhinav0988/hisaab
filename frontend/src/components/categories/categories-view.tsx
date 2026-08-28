"use client";
import type { Category } from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { categoryService } from "@/services/category.service";

export function CategoriesView() {
  const client = useQueryClient();
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  if (categories.isLoading) return <PageSkeleton />;
  if (!categories.data) return <ErrorState retry={() => void categories.refetch()} />;
  const refresh = () => void client.invalidateQueries({ queryKey: ["categories"] });
  const custom = categories.data.filter((item) => !item.isSystem);
  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Categories"
        description="Classify income and spending. System categories stay available for everyone."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} />
            New category
          </Button>
        }
      />
      {categories.data.length ? (
        <div className="mt-7 grid gap-6 md:grid-cols-2">
          {(["EXPENSE", "INCOME"] as const).map((type) => (
            <Card key={type} className="p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                {type === "EXPENSE" ? "Expense categories" : "Income categories"}
              </p>
              <div className="grid gap-2">
                {categories.data
                  .filter((item) => item.type === type)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border bg-[var(--surface)] px-3 py-2.5"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.colour }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {item.name}
                      </span>
                      {item.isSystem ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          System
                        </span>
                      ) : (
                        <span className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            className="px-2"
                            onClick={() => setEditing(item)}
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-2"
                            onClick={() => {
                              void categoryService
                                .delete(item.id)
                                .then(() => {
                                  toast.success("Category deleted");
                                  refresh();
                                })
                                .catch((error: Error) => toast.error(error.message));
                            }}
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-7">
          <EmptyState
            title="No categories yet"
            description="Create an income or expense category to classify transactions."
            action={<Button onClick={() => setOpen(true)}>Create category</Button>}
          />
        </div>
      )}
      {custom.length === 0 && categories.data.length > 0 ? (
        <p className="mt-4 text-xs text-[var(--muted-foreground)]">
          Custom categories you create can be edited or removed. System ones cannot.
        </p>
      ) : null}
      <Modal
        open={open || Boolean(editing)}
        title={editing ? "Edit category" : "Create category"}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <CategoryForm
          key={editing?.id ?? "new"}
          initial={editing ?? undefined}
          onSaved={() => {
            setOpen(false);
            setEditing(null);
            toast.success(editing ? "Category updated" : "Category created");
            refresh();
          }}
        />
      </Modal>
    </div>
  );
}

function CategoryForm({ initial, onSaved }: { initial?: Category; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "EXPENSE");
  const [colour, setColour] = useState(initial?.colour ?? "#247349");
  const mutation = useMutation({
    mutationFn: () =>
      initial
        ? categoryService.update(initial.id, { name, type, colour, icon: initial.icon || "Tag" })
        : categoryService.create({ name, type, colour, icon: "Tag" }),
    onSuccess: onSaved,
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <Field label="Category name">
        <Input required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <Select
            value={type}
            onChange={(event) => setType(event.target.value as Category["type"])}
            disabled={Boolean(initial)}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </Select>
        </Field>
        <Field label="Colour">
          <Input type="color" value={colour} onChange={(event) => setColour(event.target.value)} />
        </Field>
      </div>
      {mutation.error ? (
        <p className="text-sm text-[var(--danger)]">{mutation.error.message}</p>
      ) : null}
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : initial ? "Save category" : "Create category"}
      </Button>
    </form>
  );
}
