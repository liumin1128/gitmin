/**
 * Global status banners (pure UI): repository error, action error, busy state.
 * A repository error suppresses the other two bars.
 */
import { t } from '../../../shared/i18n';

interface Props {
  repoError: string | null;
  error: string | null;
  busy: boolean;
}

export function AppStatusBars({ repoError, error, busy }: Props) {
  return (
    <>
      {repoError && (
        <div className="error-bar" role="alert">
          <span className="codicon codicon-error" aria-hidden="true" />
          <span>{repoError}</span>
        </div>
      )}
      {!repoError && error && (
        <div className="error-bar" role="alert">
          <span className="codicon codicon-error" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {!repoError && busy && (
        <div className="busy-bar" role="status">
          <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden="true" />
          <span>{t('common.executing')}</span>
        </div>
      )}
    </>
  );
}
