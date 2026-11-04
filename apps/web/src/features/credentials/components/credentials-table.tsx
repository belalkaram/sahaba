'use client';

import React from 'react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { SkeletonTable } from '../../../components/ui/skeleton';
import { CredentialItem } from '../../../lib/credentials-api';
import { SmartphoneIcon, ShieldIcon } from '../../../components/icons';

import { KeyRound } from 'lucide-react';
import { formatDate } from '../../../lib/format';
export interface CredentialsTableProps {
  credentials: CredentialItem[];
  loading: boolean;
  onOpenIssueModal: () => void;
  onReplaceDevice: (cred: CredentialItem) => void;
  onRevoke: (cred: CredentialItem) => void;
  onCopyCode: (code: string) => void;
}

export const CredentialsTable: React.FC<CredentialsTableProps> = ({
  credentials,
  loading,
  onOpenIssueModal,
  onReplaceDevice,
  onRevoke,
  onCopyCode,
}) => {
  if (loading) {
    return <SkeletonTable rows={3} cols={4} />;
  }

  if (credentials.length === 0) {
    return (
      <EmptyState
        title="لا توجد أكواد دخول صادرة لهذا الطالب"
        description="لم يتم إصدار بطاقة ترخيص أو كود دخول لهذا الطالب حتى الآن. يمكنك إصدار كود جديد فوراً."
        action={{
          label: 'إصدار كود دخول الآن',
          onClick: onOpenIssueModal,
        }}
        icon={<KeyRound size={20} strokeWidth={1.75} aria-hidden />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {credentials.map((cred) => {
        const isBindingActive = Boolean(cred.device_binding);
        const deviceName = cred.device_binding?.device_name || 'جهاز غير معروف';
        const fingerprint = cred.device_binding?.device_fingerprint || 'غير متوفر';

        return (
          <div
            key={cred.id}
            className={`rounded-2xl border p-5 transition-all ${
              cred.status === 'active'
                ? 'border-border bg-surface'
                : 'border-border-subtle bg-surface-sunken opacity-75'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left: Credential Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-base font-bold text-primary bg-primary-subtle px-3.5 py-1.5 rounded-md border border-primary/20 tracking-wider">
                    {cred.credential_code}
                  </span>
                  <button
                    onClick={() => onCopyCode(cred.credential_code)}
                    className="text-xs text-fg-muted hover:text-fg px-2.5 py-1 rounded-xs bg-surface-raised border border-border transition-colors"
                  >
                    نسخ الكود
                  </button>
                  <Badge
                    variant={
                      cred.status === 'active'
                        ? 'success'
                        : cred.status === 'revoked'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {cred.status === 'active'
                      ? 'نشط ومقترن'
                      : cred.status === 'revoked'
                      ? 'معطل (Revoked)'
                      : 'معلق'}
                  </Badge>
                </div>

                {/* Device Binding Info Box */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-fg-muted">
                  <div className="flex items-center gap-1.5 bg-surface-raised border border-border px-3 py-1.5 rounded-sm">
                    <SmartphoneIcon size={16} className="text-primary" />
                    <span>الجهاز المقترن:</span>
                    <span className="font-semibold text-fg">
                      {isBindingActive ? deviceName : 'بانتظار تسجيل الدخول الأول'}
                    </span>
                  </div>

                  {isBindingActive && (
                    <div className="flex items-center gap-1.5 bg-surface-raised border border-border px-3 py-1.5 rounded-sm font-mono text-xs text-fg-muted">
                      <ShieldIcon size={14} className="text-primary" />
                      <span>البصمة: {fingerprint.slice(0, 16)}...</span>
                    </div>
                  )}

                  {cred.issued_at && (
                    <span className="text-xs text-fg-subtle">
                      صدر في: {formatDate(cred.issued_at)}
                    </span>
                  )}
                </div>

                {/* Revocation reason if revoked */}
                {cred.status === 'revoked' && cred.revocation_reason && (
                  <p className="text-xs text-danger bg-danger-subtle px-3 py-1 rounded-sm border border-danger/20 inline-block">
                    سبب التعطيل: {cred.revocation_reason}
                  </p>
                )}
              </div>

              {/* Right: Actions */}
              {cred.status === 'active' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReplaceDevice(cred)}
                  >
                    استبدال الجهاز المقترن
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onRevoke(cred)}
                  >
                    تعطيل الكود
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

