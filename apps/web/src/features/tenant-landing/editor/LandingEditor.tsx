'use client';

/**
 * TL-5/TL-6 (ADR-007): Main landing editor orchestrator.
 *
 * Layout: control column (right/RTL) + preview iframe (left).
 * Tabs: القالب / الألوان / الأقسام (includes content editors for about/contact/faq).
 * Auto-saves draft 2s after last change. No fake successes.
 */
import { Check } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../context/auth-context';
import { DataState } from '../../../components/ui/data-state';
import { landingApi, DEFAULT_LANDING_DRAFT } from '../api';
import type { LandingDraft, LandingPalette, LandingSections, LandingContent } from '../api';
import { TemplatePicker } from './TemplatePicker';
import { PaletteEditor } from './PaletteEditor';
import { AboutEditor } from './AboutEditor';
import type { AboutContent } from './AboutEditor';
import { FaqEditor } from './FaqEditor';
import type { FaqItem } from './FaqEditor';
import { ContactEditor } from './ContactEditor';
import type { ContactContent } from './ContactEditor';
import { PublishBar } from './PublishBar';
import { PreviewFrame } from './PreviewFrame';
import type { TemplateId } from '../templates/types';
import { cn } from '../../../lib/cn';

type Tab = 'template' | 'colors' | 'sections';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SECTION_LABELS: Record<keyof LandingSections, string> = {
  stats:    'الأرقام والإحصاءات',
  courses:  'المقررات',
  teachers: 'المدرسون',
  about:    'عن الأكاديمية',
  contact:  'معلومات التواصل',
  faq:      'الأسئلة الشائعة',
};

export function LandingEditor() {
  const { tenant } = useAuth();
  const slug = tenant?.slug ?? '';

  // ── Remote state ────────────────────────────────────────────────────────────
  const [loadStatus, setLoadStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  // ── Local draft (what the user edits) ────────────────────────────────────
  const [draft, setDraft] = useState<LandingDraft>(DEFAULT_LANDING_DRAFT);

  // ── UI ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('template');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<{ version: number } | null>(null);
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const tokenIssuedAt = useRef(0);

  // ── Auto-save timer ──────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoad = useRef(true);

  // Load from server
  useEffect(() => {
    setLoadStatus('loading');
    landingApi
      .getState()
      .then(({ data }) => {
        const resolved = data.draft ?? data.published ?? DEFAULT_LANDING_DRAFT;
        setDraft(resolved);
        setHasDraft(!!data.draft);
        setDraftUpdatedAt(data.draft_updated_at);
        setLoadStatus('ready');
      })
      .catch(() => setLoadStatus('error'));
  }, []);

  // Preview token for the draft (15 minutes). Declared before the effects that use it.
  async function requestToken() {
    setLoadingToken(true);
    try {
      const { data } = await landingApi.getPreviewToken();
      tokenIssuedAt.current = Date.now();
      setPreviewToken(data.token);
    } catch {
      // No token: the frame shows the published page and the overlay offers a retry.
      setPreviewToken(null);
    } finally {
      setLoadingToken(false);
    }
  }
  const handleRequestToken = requestToken;

  // Open the editor on the draft, not the published page.
  useEffect(() => {
    if (loadStatus === 'ready' && tokenIssuedAt.current === 0) void requestToken();
  }, [loadStatus]);

  // Auto-save on draft change (skip the first render)
  useEffect(() => {
    if (loadStatus !== 'ready') return;
    if (initialLoad.current) { initialLoad.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(() => {
      landingApi
        .saveDraft({
          template: draft.template,
          palette: draft.palette,
          sections: draft.sections,
          content: draft.content,
        })
        .then(async () => {
          // Tokens live 15 minutes; renew shortly before expiry so the preview keeps the draft.
          if (Date.now() - tokenIssuedAt.current > 13 * 60_000) await requestToken();
          setPreviewRefresh((n) => n + 1);
          setSaveStatus('saved');
          setHasDraft(true);
          setDraftUpdatedAt(new Date().toISOString());
          setTimeout(() => setSaveStatus('idle'), 3000);
        })
        .catch(() => setSaveStatus('error'));
    }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const setTemplate = (id: TemplateId) => setDraft((d) => ({ ...d, template: id }));
  const setPalette = (p: LandingPalette) => setDraft((d) => ({ ...d, palette: p }));
  const toggleSection = (k: keyof LandingSections) =>
    setDraft((d) => ({ ...d, sections: { ...d.sections, [k]: !d.sections[k] } }));
  const setContent = (patch: Partial<LandingContent>) =>
    setDraft((d) => ({ ...d, content: { ...d.content, ...patch } }));


  const handleDiscard = async () => {
    setDiscarding(true);
    try {
      await landingApi.discardDraft();
      const { data } = await landingApi.getState();
      const resolved = data.published ?? DEFAULT_LANDING_DRAFT;
      setDraft(resolved);
      setHasDraft(false);
      setDraftUpdatedAt(null);
      setPreviewToken(null);
      // Publishing/discarding invalidates the token server-side; the next save asks for a new one.
      tokenIssuedAt.current = 0;
      setPreviewRefresh((n) => n + 1);
    } finally {
      setDiscarding(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const { data } = await landingApi.publish();
      setHasDraft(false);
      setDraftUpdatedAt(null);
      setPreviewToken(null);
      // Publishing/discarding invalidates the token server-side; the next save asks for a new one.
      tokenIssuedAt.current = 0;
      setPreviewRefresh((n) => n + 1);
      setPublishSuccess({ version: data.version });
    } finally {
      setPublishing(false);
    }
  };

  if (loadStatus === 'loading' || loadStatus === 'error') {
    const reload = () => {
      setLoadStatus('loading');
      landingApi
        .getState()
        .then(({ data }) => {
          setDraft(data.draft ?? data.published ?? DEFAULT_LANDING_DRAFT);
          setHasDraft(!!data.draft);
          setDraftUpdatedAt(data.draft_updated_at);
          setLoadStatus('ready');
        })
        .catch(() => setLoadStatus('error'));
    };
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <DataState
          state={loadStatus === 'loading' ? 'loading' : 'error'}
          message={loadStatus === 'error' ? 'تعذّر تحميل إعدادات الصفحة. تحقق من الاتصال ثم أعد المحاولة.' : undefined}
          onRetry={loadStatus === 'error' ? reload : undefined}
        />
      </div>
    );
  }

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'template', label: 'القالب' },
    { id: 'colors',   label: 'الألوان' },
    { id: 'sections', label: 'الأقسام' },
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {publishSuccess && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-primary-subtle px-4 py-3 text-sm text-primary-subtle-fg sm:px-6" role="status">
          <span className="inline-flex items-center gap-1.5"><Check aria-hidden className="h-4 w-4" />نُشرت الصفحة (الإصدار {publishSuccess.version}). قد تستغرق التغييرات حتى دقيقة لتظهر.</span>
          <button type="button" onClick={() => setPublishSuccess(null)} className="text-fg-muted hover:text-fg text-xs">إغلاق</button>
        </div>
      )}

      {/* Two-column layout on lg+ */}
      <div className="flex flex-1 flex-col lg:flex-row-reverse">
        {/* ── Control column ─────────────────────────────────────────────── */}
        <aside className="w-full shrink-0 border-b border-border lg:w-[22rem] lg:border-b-0 lg:border-s">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors',
                  tab === t.id
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-fg-muted hover:text-fg',
                )}
                aria-selected={tab === t.id}
                role="tab"
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 14rem)' }}>
            {tab === 'template' && (
              <TemplatePicker value={draft.template} onChange={setTemplate} />
            )}
            {tab === 'colors' && (
              <PaletteEditor value={draft.palette} onChange={setPalette} />
            )}
            {tab === 'sections' && (
              <div className="space-y-4">
                <p className="text-sm text-fg-muted">اختر الأقسام التي تظهر في صفحتك العامة.</p>

                {/* Section toggles */}
                <div className="space-y-2">
                  {(Object.keys(SECTION_LABELS) as Array<keyof LandingSections>).map((k) => (
                    <label key={k} className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-surface-muted">
                      <span className="text-sm font-medium text-fg">{SECTION_LABELS[k]}</span>
                      <input
                        type="checkbox"
                        checked={draft.sections[k]}
                        onChange={() => toggleSection(k)}
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                    </label>
                  ))}
                </div>

                {/* Content editors — appear when section is enabled */}
                {draft.sections.about && (
                  <div className="space-y-2 rounded-lg border border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">محتوى قسم «عن الأكاديمية»</p>
                    <AboutEditor
                      value={{
                        text: draft.content?.about?.text ?? '',
                        highlights: draft.content?.about?.highlights ?? [],
                      }}
                      onChange={(v: AboutContent) =>
                        setContent({ about: { text: v.text, highlights: v.highlights } })
                      }
                    />
                  </div>
                )}

                {draft.sections.faq && (
                  <div className="space-y-2 rounded-lg border border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">الأسئلة الشائعة</p>
                    <FaqEditor
                      value={(draft.content?.faq ?? []) as FaqItem[]}
                      onChange={(v: FaqItem[]) => setContent({ faq: v })}
                    />
                  </div>
                )}

                {draft.sections.contact && (
                  <div className="space-y-2 rounded-lg border border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">معلومات التواصل</p>
                    <ContactEditor
                      value={(draft.content?.contact ?? {}) as ContactContent}
                      onChange={(v: ContactContent) => setContent({ contact: v })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── Preview column ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col bg-surface-sunken">
          <PreviewFrame
            slug={slug}
            previewToken={previewToken}
            onRequestToken={handleRequestToken}
            loadingToken={loadingToken}
            refreshKey={previewRefresh}
            hasDraft={hasDraft}
          />
        </div>
      </div>

      {/* Fixed publish bar */}
      <PublishBar
        hasDraft={hasDraft}
        draftUpdatedAt={draftUpdatedAt}
        saveStatus={saveStatus}
        onPreview={handleRequestToken}
        onDiscard={handleDiscard}
        onPublish={handlePublish}
        publishing={publishing}
        discarding={discarding}
      />
    </div>
  );
}
