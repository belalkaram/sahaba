'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { ApiError } from '../../../lib/api-client';
import { formatDate } from '../../../lib/format';
import { googleIntegrationApi, type GoogleConnectionStatus } from '../api';

const CALLBACK_MESSAGES: Record<string, { tone: 'success' | 'danger'; text: string }> = {
  connected: { tone: 'success', text: 'تم ربط حساب Google بنجاح.' },
  denied: { tone: 'danger', text: 'لم تتم الموافقة على الربط في صفحة Google.' },
  state: { tone: 'danger', text: 'انتهت صلاحية طلب الربط. أعد المحاولة.' },
  exchange: { tone: 'danger', text: 'تعذّر إتمام الربط مع Google. أعد المحاولة.' },
};

/** Reads ?google=…&reason=… set by the API callback redirect, then removes it from the address bar. */
function readCallbackResult(): { tone: 'success' | 'danger'; text: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const result = params.get('google');
  if (!result) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return CALLBACK_MESSAGES[result === 'connected' ? 'connected' : params.get('reason') ?? 'exchange'] ?? CALLBACK_MESSAGES.exchange;
}

/** ADR-008: the academy's single Google connection (Drive uploads now, Meet via Calendar in R8-6). */
export function GoogleConnectionCard() {
  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setStatus(await googleIntegrationApi.status());
    } catch (err) {
      setLoadError(err instanceof ApiError && err.status === 403 ? 'لا تملك صلاحية إدارة التكاملات.' : 'تعذّر تحميل حالة الربط.');
    }
  }, []);

  useEffect(() => {
    setNotice(readCallbackResult());
    void load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    try {
      window.location.assign(await googleIntegrationApi.authorizationUrl());
    } catch (err) {
      setBusy(false);
      setNotice({
        tone: 'danger',
        text: err instanceof ApiError && err.code === 'GOOGLE_NOT_CONFIGURED' ? 'بيانات Google غير مضبوطة على الخادم.' : 'تعذّر بدء الربط.',
      });
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      setStatus(await googleIntegrationApi.disconnect());
      setNotice({ tone: 'success', text: 'تم فصل حساب Google.' });
    } catch {
      setNotice({ tone: 'danger', text: 'تعذّر فصل الحساب.' });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const badge = !status
    ? null
    : status.connected
      ? <Badge variant="success" size="sm">متصل</Badge>
      : status.status === 'error'
        ? <Badge variant="danger" size="sm">يحتاج إعادة ربط</Badge>
        : <Badge variant="neutral" size="sm">غير متصل</Badge>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-surface-muted text-fg-muted">
          <HardDrive size={20} strokeWidth={1.75} aria-hidden />
        </span>
        {badge}
      </div>
      <h2 className="ltr-isolate text-base font-bold text-fg">Google Drive و Google Meet</h2>
      <p className="text-sm leading-relaxed text-fg-muted">
        حساب Google واحد للمؤسسة: تُرفع الفيديوهات إلى مجلد خاص بها، وتُستخدم الصلاحية نفسها لاحقاً لإنشاء حصص Meet.
      </p>

      {notice && (
        <p role="status" className={`text-xs font-semibold ${notice.tone === 'success' ? 'text-success' : 'text-danger'}`}>
          {notice.text}
        </p>
      )}

      {loadError ? (
        <p className="text-xs text-danger">{loadError}</p>
      ) : !status ? (
        <p className="text-xs text-fg-subtle">جارٍ التحميل…</p>
      ) : (
        <div className="space-y-3 border-t border-border-subtle pt-3 text-xs text-fg-muted">
          {status.account_email && (
            <p>
              الحساب: <span className="ltr-isolate font-mono text-fg">{status.account_email}</span>
              {status.connected_at && <> · منذ {formatDate(status.connected_at)}</>}
            </p>
          )}
          {status.status === 'error' && <p className="text-danger">ألغت Google صلاحية الربط. أعد الربط لمتابعة الرفع.</p>}
          {!status.configured && <p className="text-danger">بيانات Google غير مضبوطة على الخادم.</p>}
          <div className="flex flex-wrap gap-2">
            {!status.connected && (
              <Button size="sm" onClick={connect} isLoading={busy} disabled={!status.configured}>
                {status.status === 'error' ? 'إعادة الربط' : 'ربط حساب Google'}
              </Button>
            )}
            {status.status !== 'not_connected' && (
              <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)} disabled={busy}>
                فصل الحساب
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={disconnect}
        title="فصل حساب Google؟"
        description="سيتوقف الرفع إلى Google Drive حتى يُعاد الربط. الفيديوهات المرفوعة تبقى في Drive وتظل تعمل."
        confirmText="فصل"
        isDestructive
        isLoading={busy}
      />
    </Card>
  );
}
