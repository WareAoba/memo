export function ActionIcon({
  name,
  className = '',
}: {
  className?: string;
  name:
    | 'memo'
    | 'close'
    | 'trash'
    | 'edit'
    | 'open'
    | 'refresh'
    | 'plus'
    | 'check'
    | 'search'
    | 'save'
    | 'left'
    | 'right'
    | 'up'
    | 'down'
    | 'play'
    | 'skip'
    | 'archive'
    | 'camera'
    | 'calendar'
    | 'calendar-add'
    | 'menu'
    | 'settings';
}) {
  const paths = {
    memo: 'M4 3h16v14l-4 4H4V3Zm4 5h8M8 12h8M8 16h4m4 5v-4h4',
    menu: 'M4 6h16M4 12h16M4 18h16',
    settings: 'M4 7h3m4 0h9M4 17h10m4 0h2M7 4h4v6H7V4Zm7 10h4v6h-4v-6Z',
    'calendar-add': 'M3 5h18v16H3V5Zm4-3v6m10-6v6M8 14h8m-4-4v8',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    save: 'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',
    left: 'M15 5l-7 7 7 7',
    right: 'M9 5l7 7-7 7',
    up: 'M5 15l7-7 7 7',
    down: 'M5 9l7 7 7-7',
    play: 'm7 4 14 8-14 8V4Z',
    skip: 'm4 5 11 7-11 7V5Zm15 0v14',
    archive: 'M3 3h18v5H3V3Zm2 5v13h14V8M9 12h6',
    camera: 'M3 7h4l2-3h6l2 3h4v14H3V7Zm13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    calendar: 'M3 5h18v16H3V5Zm4-3v6m10-6v6M3 11h18',
    close: 'M6 6l12 12M18 6L6 18',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
    edit: 'M15 4l5 5M4 20l5-1L21 7l-5-5L4 14v6Z',
    open: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
    refresh: 'M20 7V3m0 4h-4M20 7a8 8 0 1 0 0 10',
    plus: 'M12 5v14M5 12h14',
    check: 'M4 12l5 5L20 6',
  };
  return (
    <svg
      className={`action-icon ${className}`}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
