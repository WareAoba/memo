import { useState } from 'react';
import { tr } from '../../i18n';
import { Input } from '../shared/ui';
import { IconButton } from '../shared/IconButton';
import { ScheduleSearch } from './ScheduleSearch';
export function ScheduleSearchControl() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <>
      <form
        className="workspace-search-form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        <Input
          type="search"
          aria-label={tr('ScheduleSearch.searchSchedules')}
          placeholder={tr('ScheduleSearch.workOrTaskNamesScheduleMemos')}
          maxLength={200}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <IconButton icon="search" type="submit" aria-label={tr('ScheduleSearch.searchSchedules')} />
      </form>
      {open && <ScheduleSearch initialQuery={query} onClose={() => setOpen(false)} />}
    </>
  );
}
