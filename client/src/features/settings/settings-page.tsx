import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock3, FolderCog, MessageSquareQuote, Pencil, Power, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, SearchInput } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useCreateCategory, usePutSlaRule, useSettingCategories, useSlaRules, useUpdateCategory } from "./settings-hooks";
import type { Priority, SettingCategory, SlaRule } from "./settings.types";
import { BranchesSection, DepartmentsSection, TeamsSection } from "./organization-sections";

const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const SECTIONS = ["categories", "departments", "branches", "teams", "sla", "quick"] as const;
export function SettingsPage() {
  const { t } = useTranslation();
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("categories");
  return <main className="page-container space-y-6"><PageHeader title={t("settings.title")} description={t("settings.description")} />
    <nav className="flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-surface p-1" aria-label={t("settings.sectionsLabel")}>
      {SECTIONS.map((key) => <Button key={key} variant={section === key ? "primary" : "ghost"} size="sm" onClick={() => setSection(key)}>{t(`settings.tabs.${key}`)}</Button>)}
    </nav>
    {section === "categories" && <CategoriesSection />}
    {section === "departments" && <DepartmentsSection />}
    {section === "branches" && <BranchesSection />}
    {section === "teams" && <TeamsSection />}
    {section === "sla" && <SlaSection />}
    {section === "quick" && <QuickRepliesSection />}
  </main>;
}

function CategoriesSection() {
  const { t } = useTranslation(); const [search, setSearch] = useState(""); const query = useSettingCategories(search); const create = useCreateCategory(); const update = useUpdateCategory();
  const [editorTarget, setEditorTarget] = useState<SettingCategory | "new" | null>(null); const [confirmTarget, setConfirmTarget] = useState<SettingCategory | null>(null);
  const toggle = (row: SettingCategory) => setConfirmTarget(row);
  const pending = create.isPending || update.isPending;
  return <><Card className="min-w-0"><CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex items-center gap-2"><FolderCog className="size-4" />{t("settings.categories.title")}</CardTitle><CardDescription className="mt-1.5">{t("settings.categories.description")}</CardDescription></div><Button className="w-full sm:w-auto" onClick={() => setEditorTarget("new")}><Plus className="size-4" />{t("settings.categories.create")}</Button></CardHeader><CardContent className="space-y-4">
      <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch("")} placeholder={t("settings.categories.search")} />
      {query.isLoading ? <State text={t("common.loading")} /> : query.isError ? <State text={t("settings.categories.loadError")} action={() => query.refetch()} /> : !query.data?.length ? <State text={search ? t("settings.categories.noResults") : t("settings.categories.empty")} /> : <CategoryRows rows={query.data} pending={pending} onEdit={setEditorTarget} onToggle={toggle} />}
    </CardContent></Card>
    {editorTarget && <CategoryEditorDialog category={editorTarget === "new" ? null : editorTarget} pending={pending} onClose={() => setEditorTarget(null)} onSubmit={async (values) => { if (editorTarget === "new") await create.mutateAsync(values); else await update.mutateAsync({ id: editorTarget.id, input: values }); setEditorTarget(null); }} />}
    {confirmTarget && <CategoryStatusDialog category={confirmTarget} pending={update.isPending} onClose={() => setConfirmTarget(null)} onConfirm={async () => { await update.mutateAsync({ id: confirmTarget.id, input: { isActive: !confirmTarget.isActive } }); setConfirmTarget(null); }} />}</>;
}
function CategoryRows({ rows, pending, onEdit, onToggle }: { rows: SettingCategory[]; pending: boolean; onEdit: (r: SettingCategory) => void; onToggle: (r: SettingCategory) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="hidden md:block">
        <TableContainer>
          <Table className="min-w-[38rem]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("settings.categories.name")}</TableHead>
                <TableHead>{t("settings.categories.fieldDescription")}</TableHead>
                <TableHead className="w-32">{t("settings.status")}</TableHead>
                <TableHead className="w-24 text-end">{t("settings.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium" dir="auto">
                    {r.name}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground" title={r.description ?? ""}>
                    {r.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Status active={r.isActive} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <ActionMenu
                        triggerLabel={t("settings.actions")}
                        items={[
                          {
                            key: "edit",
                            label: t("common.edit"),
                            icon: <Pencil className="size-4" />,
                            onClick: () => onEdit(r),
                          },
                          {
                            key: "status",
                            label: r.isActive ? t("settings.deactivate") : t("settings.activate"),
                            icon: <Power className="size-4" />,
                            disabled: pending,
                            destructive: r.isActive,
                            onClick: () => onToggle(r),
                          },
                        ]}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
      <ul className="divide-y divide-border-subtle rounded-xl border border-table-border bg-table-background shadow-subtle md:hidden">
        {rows.map((r) => (
          <li className="p-4" key={r.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium" dir="auto">{r.name}</p>
                <p className="mt-1 break-words text-sm text-muted-foreground" dir="auto">{r.description || "—"}</p>
              </div>
              <Status active={r.isActive} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => onEdit(r)}>
                <Pencil className="size-3.5" />{t("common.edit")}
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => onToggle(r)}>
                <Power className="size-3.5" />{r.isActive ? t("settings.deactivate") : t("settings.activate")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
function Status({ active }: { active: boolean }) { const { t } = useTranslation(); return <Badge variant={active ? "success" : "neutral"}>{active ? t("settings.active") : t("settings.inactive")}</Badge>; }

function CategoryEditorDialog({ category, pending, onClose, onSubmit }: { category: SettingCategory | null; pending: boolean; onClose: () => void; onSubmit: (values: { name: string; description: string }) => Promise<void> }) {
  const { t } = useTranslation(); const nameRef = useRef<HTMLInputElement>(null); const [name, setName] = useState(category?.name ?? ""); const [description, setDescription] = useState(category?.description ?? ""); const [error, setError] = useState("");
  useEffect(() => { nameRef.current?.focus(); const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) onClose(); }; document.addEventListener("keydown", onKeyDown); return () => document.removeEventListener("keydown", onKeyDown); }, [onClose, pending]);
  const submit = async () => { setError(""); if (name.trim().length < 2) { setError(t("settings.categories.validation")); return; } try { await onSubmit({ name, description }); } catch { setError(t("settings.categories.saveError")); } };
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}><Card role="dialog" aria-modal="true" aria-labelledby="category-editor-title" className="w-full max-w-lg shadow-elevated"><CardHeader><CardTitle id="category-editor-title">{t(category ? "settings.categories.edit" : "settings.categories.create")}</CardTitle><CardDescription>{t("settings.categories.formDescription")}</CardDescription></CardHeader><CardContent className="space-y-4"><label className="block text-sm font-medium">{t("settings.categories.name")}<Input ref={nameRef} className="mt-1" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm font-medium">{t("settings.categories.fieldDescription")}<Textarea className="mt-1" value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} /></label>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><Button variant="secondary" disabled={pending} onClick={onClose}>{t("common.cancel")}</Button><Button isLoading={pending} onClick={submit}>{t("common.save")}</Button></div></CardContent></Card></div>, document.body);
}

function CategoryStatusDialog({ category, pending, onClose, onConfirm }: { category: SettingCategory; pending: boolean; onClose: () => void; onConfirm: () => Promise<void> }) {
  const { t } = useTranslation(); const cancelRef = useRef<HTMLButtonElement>(null); const [error, setError] = useState(false); const deactivating = category.isActive;
  useEffect(() => { cancelRef.current?.focus(); const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) onClose(); }; document.addEventListener("keydown", onKeyDown); return () => document.removeEventListener("keydown", onKeyDown); }, [onClose, pending]);
  const confirm = async () => { setError(false); try { await onConfirm(); } catch { setError(true); } };
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <Card role="alertdialog" aria-modal="true" aria-labelledby="category-status-title" aria-describedby="category-status-description" className="w-full max-w-md shadow-elevated">
      <CardHeader><div className="flex size-10 items-center justify-center rounded-lg bg-surface-subtle text-muted-foreground"><Power className="size-5" aria-hidden="true" /></div><CardTitle id="category-status-title" className="pt-2" dir="auto">{t(deactivating ? "settings.categories.deactivateTitle" : "settings.categories.activateTitle", { name: category.name })}</CardTitle><CardDescription id="category-status-description">{t(deactivating ? "settings.categories.confirmDeactivate" : "settings.categories.confirmActivate", { name: category.name })}</CardDescription></CardHeader>
      <CardContent>{error && <p role="alert" className="mb-4 text-sm text-danger">{t("settings.categories.statusError")}</p>}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button ref={cancelRef} variant="secondary" disabled={pending} onClick={onClose}>{t("common.cancel")}</Button><Button variant={deactivating ? "destructive" : "primary"} isLoading={pending} onClick={confirm}>{error ? t("common.retry") : t(deactivating ? "settings.deactivate" : "settings.activate")}</Button></div></CardContent>
    </Card>
  </div>, document.body);
}

function SlaSection() { const { t } = useTranslation(); const query = useSlaRules(); if (query.isLoading) return <State text={t("common.loading")} />; if (query.isError) return <State text={t("settings.sla.loadError")} action={() => query.refetch()} />; return <div className="grid gap-4 sm:grid-cols-2">{priorities.map((p) => <SlaCard key={p} priority={p} rule={query.data?.find((r) => r.priority === p)} />)}</div>; }
function SlaCard({ priority, rule }: { priority: Priority; rule?: SlaRule }) { const { t } = useTranslation(); const save = usePutSlaRule(); const [first, setFirst] = useState(rule?.firstResponseMinutes ?? 60); const [resolution, setResolution] = useState(rule?.resolutionMinutes ?? 480); const [active, setActive] = useState(rule?.isActive ?? true); const [error, setError] = useState(""); useEffect(() => { if (rule) { setFirst(rule.firstResponseMinutes); setResolution(rule.resolutionMinutes); setActive(rule.isActive); } }, [rule]); const submit = async () => { setError(""); if (first < 1 || resolution < first || first > 525600 || resolution > 525600) { setError(t("settings.sla.validation")); return; } try { await save.mutateAsync({ priority, input: { firstResponseMinutes: first, resolutionMinutes: resolution, isActive: active } }); } catch { setError(t("settings.sla.saveError")); } }; return <Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><Clock3 className="size-4" />{t(`tickets.priority.${priority}`)}</CardTitle><Status active={active} /></div><CardDescription>{rule ? t("settings.sla.configured") : t("settings.sla.missing")}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">{t("settings.sla.first")}<Input className="mt-1" type="number" min={1} max={525600} value={first} onChange={(e) => setFirst(Number(e.target.value))} /></label><label className="text-sm font-medium">{t("settings.sla.resolution")}<Input className="mt-1" type="number" min={1} max={525600} value={resolution} onChange={(e) => setResolution(Number(e.target.value))} /></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{t("settings.sla.enabled")}</label>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button onClick={submit} isLoading={save.isPending}>{rule ? t("common.save") : <><Plus className="size-4" />{t("settings.sla.create")}</>}</Button></CardContent></Card>; }
function QuickRepliesSection() { const { t } = useTranslation(); return <Card className="max-w-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareQuote className="size-4" />{t("settings.quick.title")}</CardTitle><CardDescription>{t("settings.quick.description")}</CardDescription></CardHeader><CardContent><Link className="button-link inline-flex w-auto items-center gap-2" to="/quick-replies"><CheckCircle2 className="size-4" />{t("settings.quick.open")}</Link></CardContent></Card>; }
function State({ text, action }: { text: string; action?: () => void }) { const { t } = useTranslation(); return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"><p>{text}</p>{action && <Button className="mt-3" variant="secondary" onClick={action}>{t("common.retry")}</Button>}</div>; }
