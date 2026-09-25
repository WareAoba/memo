import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import type { WorkFields } from '../../api/works';
export function Requirements({ value }: { value: WorkFields }) {
  useTranslation();
  return (
    <div className="tags">
      {value.advance_contact_required && (
        <span className="requirement">{tr('Requirements.advanceContactRequired')}</span>
      )}
      {value.notice_required && (
        <span className="requirement">{tr('Requirements.noticeRequired')}</span>
      )}
      {value.default_work_start_time && (
        <span className="tag">
          {tr('Requirements.availableValueValue', {
            v1: value.default_work_start_time,
            v2: value.default_work_end_time,
          })}
        </span>
      )}
    </div>
  );
}
